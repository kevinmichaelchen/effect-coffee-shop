import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Test from "alchemy/Test/Vitest";
import { makeAuthClient } from "@effect-coffee-shop/coffee-auth/testing/auth-client";
import { makeTestPasskey } from "@effect-coffee-shop/coffee-auth/testing/passkey";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { makeOrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { CustomerId } from "@effect-coffee-shop/coffee-domain/Customer/Customer.id";
import { Passkey } from "@yielded/auth";
import * as Domain from "alchemy/Domain";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import { expect } from "vitest";
import Stack from "./cloudflare.ts";

const { afterAll, beforeAll, deploy, destroy, test } = Test.make({
  dev: true,
  providers: Cloudflare.providers(),
  // Run the local providers in-process. Behind Alchemy's RPC sidecar the
  // Vite-hosted Worker deploys and serves fine, but `destroy(Stack)` never
  // returns, so the suite dies on the afterAll timeout.
  sidecar: false,
  state: Alchemy.localState(),
});

const deployed = beforeAll(deploy(Stack), { timeout: 300_000 });

afterAll(destroy(Stack), { timeout: 300_000 });

const HealthResponse = Schema.Struct({ status: Schema.Literal("ok") });
const Viewer = Schema.Struct({
  kind: Schema.Literal("customer"),
  displayName: Schema.String,
  userId: CustomerId,
});

test(
  "serves the Coffee API through Alchemy's local Cloudflare runtime",
  Effect.gen(function* () {
    const { api } = yield* deployed;
    const response = yield* HttpClient.get(new URL("/api/health", api));
    const health = yield* HttpClientResponse.schemaBodyJson(HealthResponse)(response);

    expect(health).toEqual({ status: "ok" });
  }),
);

test(
  "requires OAuth for remote MCP and advertises discovery",
  Effect.gen(function* () {
    const { api } = yield* deployed;
    const response = yield* HttpClient.execute(HttpClientRequest.post(new URL("/mcp", api)));
    expect(response.status).toBe(401);
    expect(response.headers["www-authenticate"]).toContain("oauth-protected-resource");
  }),
);

test(
  "returns 404 for the retired assistant and agent discovery endpoints",
  Effect.forEach(
    ["/api/assistant", "/api/auth/agent-configuration"],
    Effect.fnUntraced(function* (path) {
      const { api } = yield* deployed;
      const response = yield* HttpClient.get(new URL(path, api));
      expect(response.status).toBe(404);
    }),
    { concurrency: 1, discard: true },
  ),
);

const Started = <A extends Schema.Top>(value: A) => Schema.TaggedStruct("Success", { value });
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Json));

/** Register and sign in a passkey user against the deployed Worker, as the browser would. */
const signedInCustomer = (api: string) =>
  Effect.promise(async () => {
    // The Worker trusts APP_ORIGIN (see vitest.config.ts); requests go to its own URL.
    const appOrigin = "http://localhost:5173";
    const client = makeAuthClient(
      {
        handler: async (request) =>
          // oxlint-disable-next-line effect/avoid-native-fetch -- The auth test client speaks Fetch; this forwards its requests to the deployed Worker.
          fetch(new URL(new URL(request.url).pathname, api), {
            method: request.method,
            headers: request.headers,
            body: request.method === "GET" ? null : await request.text(),
          }),
      },
      appOrigin,
    );
    const flow = () => ({
      flowId: crypto.randomUUID(),
      commandId: crypto.randomUUID(),
      profileId: "default",
    });
    const registration = Schema.decodeUnknownSync(Started(Passkey.PasskeyRegistrationStarted))(
      await (
        await client.send("/register", { ...flow(), registration: { displayName: "Sam" } })
      ).json(),
    ).value;
    const authenticator = makeTestPasskey(appOrigin, registration.options.user.id);
    const registered = await client.send("/completeRegistration", {
      flowId: registration.flowId,
      response: encodeJson(authenticator.register(registration.options.challenge)),
    });
    const login = Schema.decodeUnknownSync(Started(Passkey.PasskeyAuthenticationStarted))(
      await (await client.send("/signIn", flow())).json(),
    ).value;
    const signedIn = await client.send("/completeSignIn", {
      flowId: login.flowId,
      response: encodeJson(authenticator.authenticate(login.options.challenge, 1)),
    });
    return {
      statuses: [registered.status, signedIn.status],
      appOrigin,
      cookie: client.request().headers.get("cookie") ?? "",
    };
  });

/** Place an order through CustomerApi as the signed-in browser, then read it back. */
const orderThroughCustomerApi = (
  api: string,
  session: { readonly cookie: string; readonly appOrigin: string },
  userId: CustomerId,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      // The browser's view of the Api: its session cookie and its origin on every call.
      const browser = Layer.effect(
        HttpClient.HttpClient,
        Effect.map(HttpClient.HttpClient, (client) =>
          client.pipe(
            HttpClient.mapRequest(
              HttpClientRequest.setHeaders({ cookie: session.cookie, origin: session.appOrigin }),
            ),
          ),
        ),
      ).pipe(Layer.provide(FetchHttpClient.layer));
      const coffee = yield* CustomerApi.client.pipe(
        Effect.provide(
          Domain.protocolHttp(new URL("/api/customer", api).toString()).pipe(
            Layer.provide(browser),
          ),
        ),
      );
      const orderId = yield* makeOrderId;
      const placed = yield* coffee.PlaceOrder({
        target: orderId,
        items: [{ drinkId: "latte", size: "medium", milk: "oat" }],
      });
      const mine = yield* coffee.CustomerOrders.get(userId).pipe(
        Effect.repeat({
          until: (view) => Boolean(view?.orders.length),
          schedule: Schedule.spaced("100 millis"),
        }),
        Effect.timeout("20 seconds"),
      );
      return { orderId, placed, mine };
    }),
  );

test(
  "hosts the domain on Durable Objects: a signed-in customer orders through CustomerApi",
  Effect.gen(function* () {
    const api = yield* Effect.fromNullishOr((yield* deployed).api);
    const session = yield* signedInCustomer(api);
    expect(session.statuses).toEqual([200, 200]);
    const me = yield* HttpClient.get(new URL("/api/me", api), {
      headers: { cookie: session.cookie },
    }).pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(Viewer)));
    expect(me).toMatchObject({ kind: "customer", displayName: "Sam" });

    const { orderId, placed, mine } = yield* orderThroughCustomerApi(api, session, me.userId);
    expect(placed.reply.order).toMatchObject({ customerName: "Sam", status: "pending" });
    expect(mine?.orders.map((order) => order.id)).toEqual([orderId]);
  }),
);

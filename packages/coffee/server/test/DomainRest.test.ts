import { describe, expect, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Domain from "@alchemy.run/domain";
import { Passkey } from "@yielded/auth";
import { actorHeader } from "@effect-coffee-shop/coffee-application/ActorHeader";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import { AuthAdaptersLive } from "@effect-coffee-shop/coffee-auth/adapters";
import { d1AuthDatabase } from "@effect-coffee-shop/coffee-auth/database";
import { makeCoffeeAuth } from "@effect-coffee-shop/coffee-auth/server";
import { makeAuthClient } from "@effect-coffee-shop/coffee-auth/testing/auth-client";
import { migrateCloudflareD1 } from "@effect-coffee-shop/coffee-auth/testing/migrate";
import { makeTestPasskey } from "@effect-coffee-shop/coffee-auth/testing/passkey";
import { type Actor, Actor as ActorSchema } from "@effect-coffee-shop/coffee-domain/Actor";
import { CoffeeShop, CoffeeShopHandlers } from "@effect-coffee-shop/coffee-domain/CoffeeShop.model";
import { CustomerId } from "@effect-coffee-shop/coffee-domain/Customer/Customer.id";
import { makeOrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { domainRestHttp } from "@effect-coffee-shop/coffee-http/domain-rest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as References from "effect/References";
import * as Schema from "effect/Schema";
import { SecureRandom } from "effect/crypto";
import { HttpRouter, HttpServer } from "effect/http";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { Miniflare } from "miniflare";
import { type DomainToolServices, domainApi } from "../src/CoffeeHttp.ts";
import { SessionLive } from "../src/Session.ts";

const World = Layer.mergeAll(SessionLive, CoffeeOrderApp.layer).pipe(
  Layer.provideMerge(CoffeeShop.layer(CoffeeShopHandlers)),
  Layer.provide(Domain.InMemory),
  Layer.provide(Layer.succeed(References.MinimumLogLevel, "Warn")),
);

const origin = "http://localhost";
const config = {
  origin,
  oauthSecret: Redacted.make("A".repeat(43)),
  mcpClients: [],
  secret: Redacted.make("coffee-auth-test-secret-at-least-32-characters"),
  staffUserIds: HashSet.empty<string>(),
};

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Json));
const encodeActor = Schema.encodeSync(Schema.fromJsonString(ActorSchema));
const barista: Actor = {
  kind: "staff",
  userId: CustomerId.make("user-bo"),
  displayName: "Bo",
};
/** What a client would send to pose as staff, if the Worker trusted it. */
const forgedStaff = { [actorHeader]: encodeActor(barista) };

const flow = SecureRandom.SecureRandom.use((random) =>
  Effect.map(
    Effect.all([random.uuidV4(), random.uuidV4()], { concurrency: 1 }),
    ([flowId, commandId]) => ({ flowId, commandId, profileId: "default" }),
  ),
).pipe(Effect.provide(SecureRandom.layerWebCrypto));

const bodyOf =
  <S extends Schema.Top>(schema: S) =>
  (response: Response) =>
    Effect.promise(async () => response.clone().text()).pipe(
      Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(schema))),
      Effect.orDie,
    );

/** A migrated D1 auth database in a local Workers runtime. */
const authDatabase = Effect.fn("DomainRestTest.authDatabase")(function* () {
  const proxy = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new Miniflare({
          modules: true,
          script: "export default { fetch() { return new Response(); } }",
          d1Databases: ["DB"],
        }),
    ),
    (proxy) => Effect.promise(async () => proxy.dispose()),
  );
  const db = yield* Effect.promise(async () => proxy.getD1Database("DB"));
  yield* migrateCloudflareD1(db).pipe(Effect.provide(NodeServices.layer));
  return d1AuthDatabase(db);
});

/** A browser that registered a passkey and signed in: its cookies carry a customer session. */
const signedInBrowser = Effect.fnUntraced(function* (database: ReturnType<typeof d1AuthDatabase>) {
  const auth = makeCoffeeAuth(config, database, AuthAdaptersLive);
  const server = yield* Effect.acquireRelease(
    Effect.sync(() =>
      HttpRouter.toWebHandler(auth.routes.pipe(Layer.provide(HttpServer.layerServices)), {
        disableLogger: true,
      }),
    ),
    (server) => Effect.promise(async () => server.dispose()),
  );
  const browser = makeAuthClient(
    { handler: async (request) => server.handler(request, Context.empty()) },
    origin,
  );
  const send = (path: string, body: Schema.Json) =>
    Effect.promise(async () => browser.send(path, body));

  const registration = yield* send("/register", {
    ...(yield* flow),
    registration: { displayName: "Sam" },
  }).pipe(
    Effect.flatMap(
      bodyOf(Schema.TaggedStruct("Success", { value: Passkey.PasskeyRegistrationStarted })),
    ),
  );
  const passkey = yield* makeTestPasskey(origin, registration.value.options.user.id);
  yield* send("/completeRegistration", {
    flowId: registration.value.flowId,
    response: encodeJson(passkey.register(registration.value.options.challenge)),
  });
  const signIn = yield* send("/signIn", yield* flow).pipe(
    Effect.flatMap(
      bodyOf(Schema.TaggedStruct("Success", { value: Passkey.PasskeyAuthenticationStarted })),
    ),
  );
  yield* send("/completeSignIn", {
    flowId: signIn.value.flowId,
    response: encodeJson(yield* passkey.authenticate(signIn.value.options.challenge, 1)),
  });
  return { cookie: new Headers(browser.request().headers).get("cookie") ?? "" };
});

const Placed = Schema.Struct({
  reply: Schema.Struct({ order: Schema.Struct({ ownerUserId: Schema.String }) }),
});
const Failure = Schema.Struct({ _tag: Schema.String });

describe("the domain Apis over REST, behind the auth session", () => {
  it.live(
    "ignores forged actor headers, authorizes each call, and serves its OpenAPI document",
    () =>
      Effect.gen(function* () {
        const database = yield* authDatabase();
        const { cookie } = yield* signedInBrowser(database);
        const input = {
          auth: Option.some(config),
          database,
          app: yield* CoffeeOrderApp,
          domain: yield* Effect.context<DomainToolServices>(),
        };
        const rest = domainApi(input, yield* domainRestHttp);
        const call = (path: string, init: RequestInit = {}) =>
          rest.pipe(
            Effect.provideService(
              HttpServerRequest.HttpServerRequest,
              HttpServerRequest.fromWeb(new Request(`${origin}${path}`, init)),
            ),
            Effect.scoped,
            Effect.map(HttpServerResponse.toWeb),
          );
        const post = (path: string, body: Schema.Json, headers: Record<string, string>) =>
          call(path, {
            method: "POST",
            headers: { "content-type": "application/json", origin, ...headers },
            body: encodeJson(body),
          });

        // Signed out, a client claiming to be staff is still nobody.
        const forged = yield* call("/api/rest/staff/OrderQueue/main", { headers: forgedStaff });
        expect(forged.status).toBe(401);
        expect(yield* bodyOf(Failure)(forged)).toEqual({ _tag: "Unauthorized" });

        // Signed in, the session decides who is calling, not the forged header.
        const orderId = yield* makeOrderId;
        const placed = yield* post(
          "/api/rest/customer/PlaceOrder",
          { target: orderId, input: { items: [{ drinkId: "latte", size: "medium" }] } },
          { cookie, ...forgedStaff },
        );
        expect(placed.status).toBe(200);
        const owner = (yield* bodyOf(Placed)(placed)).reply.order.ownerUserId;
        expect(owner).not.toBe(barista.userId);

        const brew = yield* post(
          "/api/rest/staff/StartBrewing",
          { target: orderId, input: {} },
          { cookie, ...forgedStaff },
        );
        expect(brew.status).toBe(403);
        expect(yield* bodyOf(Failure)(brew)).toEqual({ _tag: "StaffOnly" });

        const queue = yield* call("/api/rest/staff/OrderQueue/main", { headers: { cookie } });
        expect(queue.status).toBe(403);

        const mine = yield* call(`/api/rest/customer/OrderSummary/${orderId}`, {
          headers: { cookie },
        });
        expect(mine.status).toBe(200);

        const repeat = yield* post(
          "/api/rest/customer/PlaceOrder",
          { target: orderId, input: { items: [{ drinkId: "latte", size: "medium" }] } },
          { cookie },
        );
        expect(repeat.status).toBe(409);
        expect(yield* bodyOf(Failure)(repeat)).toEqual({ _tag: "AlreadyPlaced" });

        // Mutations must come from the app's own origin.
        const crossSite = yield* post(
          "/api/rest/customer/ClearCart",
          { target: owner, input: {} },
          { cookie, origin: "https://attacker.example" },
        );
        expect(crossSite.status).toBe(403);

        const openApi = yield* call("/api/rest/openapi.json");
        expect(openApi.status).toBe(200);
        const Operation = Schema.Struct({ description: Schema.optional(Schema.String) });
        const document = yield* bodyOf(
          Schema.Struct({
            paths: Schema.Record(
              Schema.String,
              Schema.Struct({ get: Schema.optional(Operation), post: Schema.optional(Operation) }),
            ),
          }),
        )(openApi);
        const paths = R.keys(document.paths);
        // Commands carry their own description; reads say what they return.
        expect(document.paths["/api/rest/customer/PlaceOrder"]?.post?.description).toContain(
          "Place a new order",
        );
        expect(document.paths["/api/rest/staff/StartBrewing"]?.post?.description).toBe(
          "Start brewing a pending order. Staff only.",
        );
        expect(document.paths["/api/rest/customer/Cart/{key}/watch"]?.get?.description).toContain(
          "Server-Sent Events",
        );
        expect(paths).toEqual(
          expect.arrayContaining([
            "/api/rest/customer/PlaceOrder",
            "/api/rest/customer/Cart/{key}",
            "/api/rest/staff/StartBrewing",
            "/api/rest/staff/OrderQueue/{key}",
          ]),
        );
      }).pipe(Effect.scoped, Effect.provide(World)),
    60_000,
  );
});

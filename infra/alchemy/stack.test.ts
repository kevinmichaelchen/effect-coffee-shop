import * as NodeSocket from "@effect/platform-node/NodeSocket";
import * as Alchemy from "alchemy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare";
import * as Docker from "@alchemy.run/docker";
import * as Rivet from "@alchemy.run/rivet";
import * as Test from "@alchemy.run/test/Vitest";
import { makeAuthClient } from "@effect-coffee-shop/coffee-auth/testing/auth-client";
import { makeTestPasskey } from "@effect-coffee-shop/coffee-auth/testing/passkey";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { mainShop } from "@effect-coffee-shop/coffee-domain/Shop/Shop.id";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import { makeOrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { CustomerId } from "@effect-coffee-shop/coffee-domain/Customer/Customer.id";
import { makeCartItemId } from "@effect-coffee-shop/coffee-domain/Cart/CartItem.id";
import { makeCheckoutId } from "@effect-coffee-shop/coffee-domain/Cart/Checkout";
import { Passkey } from "@yielded/auth";
import * as Domain from "@alchemy.run/domain";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpBody from "effect/http/HttpBody";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Socket from "effect/socket/Socket";
import * as Stream from "effect/Stream";
import { expect } from "vitest";
import CloudflareStack from "./cloudflare.ts";
import RivetStack from "./rivet.ts";

/**
 * The same suite runs over either host of the model: Cloudflare Durable
 * Objects by default, or Rivet on a local Docker swarm with
 * `COFFEE_TEST_HOST=rivet` (`bun run test:rivet`).
 */
const host = Schema.decodeUnknownSync(Schema.Literals(["cloudflare", "rivet"]))(
  process.env.COFFEE_TEST_HOST ?? "cloudflare",
);
const Stack = host === "rivet" ? RivetStack : CloudflareStack;

const { afterAll, beforeAll, deploy, destroy, test } = Test.make({
  dev: true,
  // Both hosts' providers: a provider only acts on the resources a stack declares.
  providers: Layer.mergeAll(
    Cloudflare.providers(),
    DomainCloudflare.providers(),
    Docker.providers(),
    Rivet.providers(),
  ),
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

const Started = <A extends Schema.Top>(value: A) => Schema.TaggedStruct("Success", { value });
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Json));

const decodeJsonResponse =
  <S extends Schema.Top>(schema: S) =>
  (response: Response) =>
    Effect.promise(async () => response.text()).pipe(
      Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(schema))),
    );

const flow = () => ({
  flowId: crypto.randomUUID(),
  commandId: crypto.randomUUID(),
  profileId: "default",
});

const AuthMethod = Schema.Literals(["GET", "POST"]);

/** Forward an auth-client request to the deployed Worker through the Fetch HttpClient. */
const forwardToWorker = (api: string, request: Request) =>
  Effect.gen(function* () {
    const method = yield* Schema.decodeUnknownEffect(AuthMethod)(request.method);
    const body =
      method === "GET"
        ? HttpBody.empty
        : HttpBody.text(
            yield* Effect.promise(async () => request.text()),
            request.headers.get("content-type") ?? undefined,
          );
    const response = yield* HttpClient.execute(
      HttpClientRequest.make(method)(new URL(new URL(request.url).pathname, api), {
        headers: request.headers,
        body,
      }),
    );
    return yield* Option.match(HttpClientResponse.toWeb(response), {
      onNone: () => Effect.die("The Fetch HttpClient always yields a web Response."),
      onSome: Effect.succeed,
    });
  }).pipe(Effect.provide(FetchHttpClient.layer), Effect.orDie);

/** Register and sign in a passkey user against the deployed Worker, as the browser would. */
const signedInCustomer = Effect.fnUntraced(function* (api: string, displayName: string) {
  // The Worker trusts APP_ORIGIN (see vitest.config.ts); requests go to its own URL.
  const appOrigin = "http://localhost:5173";
  const services = yield* Effect.context();
  const client = makeAuthClient(
    {
      handler: async (request) => Effect.runPromiseWith(services)(forwardToWorker(api, request)),
    },
    appOrigin,
  );
  const send = (path: string, body: Schema.Json) =>
    Effect.promise(async () => client.send(path, body));
  const { value: registration } = yield* send("/register", {
    ...flow(),
    registration: { displayName },
  }).pipe(Effect.flatMap(decodeJsonResponse(Started(Passkey.PasskeyRegistrationStarted))));
  const authenticator = yield* makeTestPasskey(appOrigin, registration.options.user.id);
  const registered = yield* send("/completeRegistration", {
    flowId: registration.flowId,
    response: encodeJson(authenticator.register(registration.options.challenge)),
  });
  const { value: login } = yield* send("/signIn", flow()).pipe(
    Effect.flatMap(decodeJsonResponse(Started(Passkey.PasskeyAuthenticationStarted))),
  );
  const signedIn = yield* send("/completeSignIn", {
    flowId: login.flowId,
    response: encodeJson(yield* authenticator.authenticate(login.options.challenge, 1)),
  });
  const cookie = client.request().headers.get("cookie") ?? "";
  const viewer = yield* HttpClient.get(new URL("/api/me", api), { headers: { cookie } }).pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(Viewer)),
  );
  return {
    statuses: [registered.status, signedIn.status],
    appOrigin,
    cookie,
    viewer,
  };
}, Effect.orDie);

type Session = { readonly cookie: string; readonly appOrigin: string };

/**
 * The browser's view of an Api: its session cookie and its origin on every
 * call and on every live read's WebSocket upgrade, as a browser on the app's
 * origin sends them.
 */
const browserProtocol = (url: string, session: Session) => {
  const headers = { cookie: session.cookie, origin: session.appOrigin };
  const http = Layer.effect(
    HttpClient.HttpClient,
    Effect.map(HttpClient.HttpClient, (client) =>
      client.pipe(HttpClient.mapRequest(HttpClientRequest.setHeaders(headers))),
    ),
  ).pipe(Layer.provide(FetchHttpClient.layer));
  // Node's WebSocket sends no cookies of its own, so the upgrade gets the browser's headers here.
  const sockets = Layer.effect(
    // @effect-diagnostics-next-line unstableApiUsage:off -- protocolWebSocket takes its sockets from this service; only a test outside a browser needs to wrap it.
    Socket.WebSocketConstructor,
    Effect.map(
      // @effect-diagnostics-next-line unstableApiUsage:off -- the same service, read to wrap Node's constructor.
      Socket.WebSocketConstructor,
      (make) => (socketUrl: string) => make(socketUrl, { headers }),
    ),
  ).pipe(Layer.provide(NodeSocket.layerWebSocketConstructor));
  return Domain.protocolWebSocket(url).pipe(Layer.provide(Layer.mergeAll(http, sockets)));
};

/** Confirm checkout through CustomerApi, then wait for its durable workflow to place the order. */
const orderThroughCustomerApi = (api: string, session: Session, userId: CustomerId) =>
  Effect.scoped(
    Effect.gen(function* () {
      const coffee = yield* CustomerApi.client.pipe(
        Effect.provide(browserProtocol(new URL("/api/customer", api).toString(), session)),
      );
      const orderId = yield* makeOrderId;
      const checkoutId = yield* makeCheckoutId;
      yield* coffee.AddCartItem(userId, {
        cartItemId: yield* makeCartItemId,
        item: { drinkId: "latte", size: "medium", milk: "oat" },
      });
      yield* coffee.PrepareCheckout(userId, { checkoutId });
      const confirmed = yield* coffee.ConfirmCheckout(userId, {
        checkoutId,
        orderId,
      });
      const mine = yield* coffee.CustomerOrders.get(userId).pipe(
        Effect.repeat({
          until: (view) => Boolean(view?.orders.length),
          schedule: Schedule.spaced("100 millis"),
        }),
        Effect.timeout("20 seconds"),
      );
      return { orderId, confirmed, mine };
    }),
  );

test(
  "fulfills a signed-in customer's checkout through a Durable Object workflow",
  Effect.gen(function* () {
    const api = yield* Effect.fromNullishOr((yield* deployed).api);
    const session = yield* signedInCustomer(api, "Sam");
    expect(session.statuses).toEqual([200, 200]);
    const me = session.viewer;
    expect(me).toMatchObject({ kind: "customer", displayName: "Sam" });

    const { orderId, confirmed, mine } = yield* orderThroughCustomerApi(api, session, me.userId);
    expect(confirmed.reply.orderId).toEqual(orderId);
    expect(mine?.orders).toMatchObject([{ customerName: "Sam", status: "pending" }]);
    expect(mine?.orders.map((order) => order.id)).toEqual([orderId]);
    const pushed = yield* liveOrders(api, session, me.userId).pipe(Effect.timeout("20 seconds"));
    expect(pushed.map((order) => order.id)).toEqual([orderId]);
    const denied = yield* liveQueue(api, session).pipe(Effect.timeout("15 seconds"), Effect.flip);
    expect(denied).toMatchObject({ _tag: "StaffOnly" });
  }),
);

/**
 * A freshly registered customer signed in through the Worker, and their own
 * CustomerApi client on the browser protocol. The client lives as long as the
 * caller's scope.
 */
const newCustomer = Effect.fnUntraced(function* () {
  const api = yield* Effect.fromNullishOr((yield* deployed).api);
  const session = yield* signedInCustomer(api, "Sam");
  const coffee = yield* CustomerApi.client.pipe(
    Effect.provide(browserProtocol(new URL("/api/customer", api).toString(), session)),
  );
  return { coffee, session, userId: session.viewer.userId };
});

test(
  "leaves no events behind when a command is rejected",
  Effect.scoped(
    Effect.gen(function* () {
      const { coffee, userId } = yield* newCustomer();
      const emptyCart = yield* coffee
        .PrepareCheckout(userId, { checkoutId: yield* makeCheckoutId })
        .pipe(Effect.flip);
      expect(emptyCart).toMatchObject({
        _tag: "InvalidOrder",
        message: "cart must include at least one item",
      });
      const unknownCheckout = yield* coffee
        .ConfirmCheckout(userId, {
          checkoutId: yield* makeCheckoutId,
          orderId: yield* makeOrderId,
        })
        .pipe(Effect.flip);
      expect(unknownCheckout).toMatchObject({ _tag: "CheckoutNotFound" });
      const missingLine = yield* coffee
        .RemoveCartItem(userId, { cartItemId: yield* makeCartItemId })
        .pipe(Effect.flip);
      expect(missingLine).toMatchObject({ _tag: "CartItemNotFound" });

      const added = yield* coffee.AddCartItem(userId, {
        cartItemId: yield* makeCartItemId,
        item: { drinkId: "latte", size: "medium", milk: "oat" },
      });
      // The cart's first committed event is also version 1: none of the three
      // rejections left an event, a receipt or a half-open transaction behind.
      expect(added).toMatchObject({ stream: `Cart/${userId}`, version: 1 });

      const history = yield* coffee.CustomerCart.list(userId, {
        atLeast: { stream: added.stream, version: added.version },
      });
      expect(history.entries.map((entry) => [entry.envelope.seq, entry.event._tag])).toEqual([
        [1, "CartItemAdded"],
      ]);
    }),
  ),
);

test(
  "places the order once when a confirmation is retried",
  Effect.scoped(
    Effect.gen(function* () {
      const { coffee, userId } = yield* newCustomer();
      const orderId = yield* makeOrderId;
      const checkoutId = yield* makeCheckoutId;
      yield* coffee.AddCartItem(userId, {
        cartItemId: yield* makeCartItemId,
        item: { drinkId: "latte", size: "medium", milk: "oat" },
      });
      yield* coffee.PrepareCheckout(userId, { checkoutId });

      // A client that timed out retries: both deliveries carry the same command id.
      const commandId = `confirm-${checkoutId}`;
      const [first, retried] = yield* Effect.all(
        [
          coffee.ConfirmCheckout(userId, { checkoutId, orderId }, { commandId }),
          coffee.ConfirmCheckout(userId, { checkoutId, orderId }, { commandId }),
        ],
        { concurrency: 2 },
      );
      expect(retried).toEqual(first);

      const placed = yield* coffee.CustomerOrders.get(userId).pipe(
        Effect.repeat({
          until: (view) => view?.orders.length === 1,
          schedule: Schedule.spaced("100 millis"),
        }),
        Effect.timeout("20 seconds"),
      );
      expect(placed?.orders.map((order) => order.id)).toEqual([orderId]);

      // A second checkout confirmed for the same order starts the saga again
      // with the same key, which reuses the run that already placed it.
      yield* coffee.AddCartItem(userId, {
        cartItemId: yield* makeCartItemId,
        item: { drinkId: "tea", size: "small" },
      });
      const secondCheckout = yield* makeCheckoutId;
      yield* coffee.PrepareCheckout(userId, { checkoutId: secondCheckout });
      const reconfirmed = yield* coffee.ConfirmCheckout(userId, {
        checkoutId: secondCheckout,
        orderId,
      });
      expect(reconfirmed.reply.orderId).toEqual(orderId);

      const summary = yield* coffee.OrderSummary.list(orderId).pipe(
        Effect.repeat({ schedule: Schedule.spaced("250 millis"), times: 4 }),
      );
      expect(summary.entries.map((entry) => entry.event._tag)).toEqual(["OrderPlaced"]);
    }),
  ),
);

test(
  "catches a view up in the order its events were committed",
  Effect.scoped(
    Effect.gen(function* () {
      const { coffee, userId } = yield* newCustomer();
      const cartItemId = yield* makeCartItemId;
      const [entries] = yield* Effect.all(
        [
          coffee.CustomerCart.events(userId).pipe(
            Stream.filter(Domain.Read.isEvent),
            Stream.take(3),
            Stream.runCollect,
            Effect.map(Arr.fromIterable),
          ),
          Effect.gen(function* () {
            yield* coffee.AddCartItem(userId, {
              cartItemId,
              item: { drinkId: "latte", size: "medium", milk: "oat" },
            });
            yield* coffee.UpdateCartItem(userId, { cartItemId, changes: { quantity: 2 } });
            yield* coffee.RemoveCartItem(userId, { cartItemId });
          }),
        ],
        { concurrency: 2 },
      );
      expect(
        entries.map((entry) => [entry.envelope.seq, entry.event._tag, entry.state?.lines.length]),
      ).toEqual([
        [1, "CartItemAdded", 1],
        [2, "CartItemUpdated", 1],
        [3, "CartItemRemoved", 0],
      ]);
    }),
  ),
);

/** The customer's orders as the app watches them: pushed over a WebSocket until one arrives. */
const liveOrders = (api: string, session: Session, userId: CustomerId) =>
  Effect.gen(function* () {
    const coffee = yield* CustomerApi.client;
    const first = yield* coffee.CustomerOrders.watch(userId).pipe(
      Stream.map(({ state }) => state?.orders ?? []),
      Stream.filter(Arr.isReadonlyArrayNonEmpty),
      Stream.runHead,
    );
    return yield* Effect.fromOption(first);
  }).pipe(
    Effect.provide(browserProtocol(new URL("/api/customer", api).toString(), session)),
    Effect.scoped,
  );

/** The staff queue watched with a customer's session: the view's guard refuses it. */
const liveQueue = (api: string, session: Session) =>
  Effect.gen(function* () {
    const staff = yield* StaffApi.client;
    return yield* staff.OrderQueue.watch(mainShop).pipe(Stream.runHead);
  }).pipe(
    Effect.provide(browserProtocol(new URL("/api/staff", api).toString(), session)),
    Effect.scoped,
  );

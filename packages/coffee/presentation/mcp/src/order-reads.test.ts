import { describe, expect, it } from "@effect/vitest";
import * as Domain from "@alchemy.run/domain";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as References from "effect/References";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpServer from "effect/ai/McpServer";
import * as McpTest from "effect/ai/McpTest";
import { actorHeader } from "@effect-coffee-shop/coffee-application/ActorHeader";
import { Actor } from "@effect-coffee-shop/coffee-domain/Actor";
import { CoffeeShop, CoffeeShopHandlers } from "@effect-coffee-shop/coffee-domain/CoffeeShop.model";
import { CurrentActor } from "@effect-coffee-shop/coffee-domain/CurrentActor.context";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { CustomerId } from "@effect-coffee-shop/coffee-domain/Customer/Customer.id";
import { makeOrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { Session, Unauthorized } from "@effect-coffee-shop/coffee-domain/Session.middleware";
import { McpActor } from "./actor.ts";
import { OpenOrdersResource, OrderResource } from "./resources.ts";

const QuietLogs = Layer.succeed(References.MinimumLogLevel, "Warn");

/** The Worker's `Session` middleware, as it reads the actor header the reads send. */
const decodeActor = Schema.decodeUnknownOption(Schema.fromJsonString(Actor));
const TestSession = Layer.succeed(Session, (effect, { headers }) =>
  Option.match(Option.flatMap(Option.fromNullishOr(headers[actorHeader]), decodeActor), {
    onNone: () => Effect.fail(new Unauthorized()),
    onSome: (actor) => Effect.provideService(effect, CurrentActor, actor),
  }),
);

const World = Layer.mergeAll(TestSession, CoffeeShop.layer(CoffeeShopHandlers)).pipe(
  Layer.provide(Domain.InMemory),
  Layer.provide(QuietLogs),
);

/** The MCP middleware that hands each handler the actor its call resolved. */
const McpActorServices = McpServer.middleware<{ provides: McpActor }>()(
  Effect.map(McpActor, (actor) => (effect) => Effect.provideService(effect, McpActor, actor)),
);

const FeaturesLive = Layer.mergeAll(OpenOrdersResource, OrderResource).pipe(
  Layer.provide(McpActorServices.layer),
);

const clientFor = (actor: Actor) =>
  McpTest.makeClient(
    FeaturesLive.pipe(
      Layer.provide(Layer.succeed(McpActor, { current: Effect.succeed(actor) })),
      Layer.provide(World),
    ),
    { protocols: [McpProtocol.v2026_07_28] },
  );

const person = (kind: Actor["kind"], userId: string, displayName: string): Actor => ({
  kind,
  userId: CustomerId.make(userId),
  displayName,
});
const sam = person("customer", "user-sam", "Sam");
const alex = person("customer", "user-alex", "Alex");
const barista = person("staff", "user-bo", "Bo");

const encodeActor = Schema.encodeSync(Schema.fromJsonString(Actor));

/** What the Worker attaches after authenticating the caller's session. */
const as = (actor: Actor) => ({ headers: { [actorHeader]: encodeActor(actor) } });

type Client = Effect.Success<ReturnType<typeof clientFor>>;

/** One resource's text, joining its contents. */
const readText = (client: Client, uri: string) =>
  Effect.gen(function* () {
    const result = yield* client.readResource({ uri });
    const contents = yield* Schema.decodeUnknownEffect(
      Schema.Array(Schema.Struct({ text: Schema.String })),
    )(result.contents);
    return contents.map((content) => content.text).join("");
  });

const OrderRefs = Schema.Array(Schema.Struct({ id: Schema.String }));
const orderRefs = (client: Client, uri: string) =>
  readText(client, uri).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(OrderRefs))),
  );

/** Views are eventually consistent: read until the expected state arrives. */
const eventually = <A, E, R>(read: Effect.Effect<A, E, R>, ready: (value: A) => boolean) =>
  read.pipe(
    Effect.repeat({ until: ready, schedule: Schedule.spaced("20 millis") }),
    Effect.timeout("3 seconds"),
  );

describe("the MCP order resources", () => {
  it.live("show a customer their own orders and staff the queue", () =>
    Effect.gen(function* () {
      const customers = yield* CustomerApi.clientInProcess;
      const orderId = yield* makeOrderId;
      yield* customers.PlaceOrder({ orderId, items: [{ drinkId: "tea", size: "small" }] }, as(sam));

      const mine = yield* clientFor(sam);
      const orders = yield* eventually(
        orderRefs(mine, "coffee://orders/open"),
        (orders) => orders.length === 1,
      );
      expect(orders).toEqual([{ id: orderId }]);

      const ticket = yield* readText(mine, `coffee://orders/${orderId}`).pipe(
        Effect.flatMap(
          Schema.decodeUnknownEffect(
            Schema.fromJsonString(Schema.Struct({ id: Schema.String, ownerUserId: Schema.String })),
          ),
        ),
      );
      expect(ticket).toEqual({ id: orderId, ownerUserId: sam.userId });

      const theirs = yield* clientFor(alex);
      expect(yield* orderRefs(theirs, "coffee://orders/open")).toEqual([]);

      const queue = yield* clientFor(barista);
      expect(
        yield* eventually(
          orderRefs(queue, "coffee://orders/open"),
          (orders) => orders.length === 1,
        ),
      ).toEqual([{ id: orderId }]);
    }).pipe(Effect.scoped, Effect.provide(World)),
  );
});

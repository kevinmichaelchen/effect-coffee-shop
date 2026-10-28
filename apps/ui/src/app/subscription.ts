import type { CoffeeOrder } from "@effect-coffee-shop/coffee-domain/Order/CoffeeOrder";
import { FeedId, OrderFeed } from "@effect-coffee-shop/coffee-domain/Order/OrderFeed";
import { Client } from "@yielded/sync/client";
import {
  Array as Arr,
  Data,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  Order,
  Queue,
  Schedule,
  Schema,
  Stream,
} from "effect";
import * as Socket from "effect/socket/Socket";
import { Subscription } from "foldkit";
import { progressEvents } from "#features/assistant/api/assistant-worker.ts";
import { toCoffeeOrder } from "#features/coffee-shop/api/order-mapping.ts";
import { feedFor } from "#app/feed.ts";
import { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";
import type { AppServices } from "#app/resources.ts";

const definition = Client.definition(OrderFeed, {
  applyEvent: (snapshot, event) => ({
    orders: [...snapshot.orders.filter((order) => order.id !== event.order.id), event.order],
  }),
});

const Connection = Schema.Struct({ userId: Schema.String, feedId: FeedId });
type Connection = typeof Connection.Type;

const connectionFor = (model: Model): Option.Option<Connection> =>
  Option.map(feedFor(model), (feedId) => ({
    userId: model.viewer.kind === "anonymous" ? "" : model.viewer.userId,
    feedId,
  }));

/** Oldest first, so the staff queue reads in the order the tickets were placed. */
const loaded = (connection: Connection, orders: ReadonlyArray<CoffeeOrder>): Message =>
  Message.LoadedOrders({
    feedId: connection.feedId,
    userId: connection.userId,
    orders: Arr.sortWith(
      orders,
      (order) => DateTime.toEpochMillis(order.createdAt),
      Order.Number,
    ).map(toCoffeeOrder),
  });

const failed = (connection: Connection): Message =>
  Message.FailedOrders({
    feedId: connection.feedId,
    userId: connection.userId,
    message: "Live updates disconnected. Reconnecting...",
  });

/** A parked replica is a dead connection: failing the stream makes the retry open a fresh one. */
class FeedParked extends Data.TaggedError("FeedParked")<{}> {}

/** One connection to the feed: its snapshot, later changes, and a message if it drops. */
const connect = (connection: Connection) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const session = yield* Client.make(definition, { persistence: { mode: "volatile" } });
      const lease = yield* session.open(OrderFeed.address(connection.feedId));
      yield* lease.ready;
      const orders = lease
        .select((snapshot) => snapshot.orders)
        .changes.pipe(
          Stream.flatMap((orders) =>
            Option.match(orders, {
              onNone: () => Stream.empty,
              onSome: (orders) => Stream.make(loaded(connection, orders)),
            }),
          ),
        );
      const parked = lease.changes.pipe(
        Stream.filter((replica) => replica.connection === "parked"),
        Stream.flatMap(() => Stream.fail(new FeedParked())),
      );
      return Stream.merge(orders, parked);
    }),
  ).pipe(
    Stream.provide(
      Client.layerWebSocketTransport(OrderFeed, {
        origin: location.origin,
        id: connection.feedId,
      }).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal)),
    ),
    Stream.provideService(Client.CurrentActor, { actorId: connection.userId }),
  );

const backoff = Schedule.exponential("250 millis").pipe(
  Schedule.modifyDelay(({ duration }) =>
    Effect.succeed(Duration.min(duration, Duration.seconds(5))),
  ),
);

/** Live orders, reconnected after every drop with a growing pause. */
const observe = (connection: Connection): Stream.Stream<Message> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const drops = yield* Queue.unbounded<Message>();
      // Emitting the message outside the retried stream keeps the backoff from resetting.
      const orders = connect(connection).pipe(
        Stream.tapError(() => Queue.offer(drops, failed(connection))),
        Stream.retry(backoff),
      );
      return Stream.merge(Stream.fromQueue(drops), orders);
    }),
  ).pipe(Stream.orDie);

export const subscriptions = Subscription.make<Model, Message, AppServices>()((entry) => ({
  orders: entry(
    { connection: Schema.Option(Connection) },
    {
      modelToDependencies: (model) => ({ connection: connectionFor(model) }),
      dependenciesToStream: ({ connection }) =>
        Option.match(connection, { onNone: () => Stream.empty, onSome: observe }),
    },
  ),
  modelProgress: entry(
    { isLoading: Schema.Boolean },
    {
      modelToDependencies: (model) => ({
        isLoading:
          model.assistant.text._tag === "Loading" || model.assistant.voice._tag === "Loading",
      }),
      dependenciesToStream: ({ isLoading }) =>
        isLoading
          ? progressEvents.pipe(
              Stream.map(({ model, loaded, total }) =>
                Message.GotModelProgress({ model, loaded, total }),
              ),
            )
          : Stream.empty,
    },
  ),
}));

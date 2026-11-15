import type { CoffeeOrder } from "@effect-coffee-shop/coffee-domain/Order/CoffeeOrder";
import { CustomerId } from "@effect-coffee-shop/coffee-domain/Customer/Customer.id";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { mainShop } from "@effect-coffee-shop/coffee-domain/Shop/Shop.id";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import {
  Array,
  DateTime,
  Duration,
  Effect,
  Match,
  Option,
  Order,
  Queue,
  Schedule,
  Schema,
  Stream,
} from "effect";
import { Subscription } from "foldkit";
import { workerNotices } from "#features/assistant/api/assistant-worker.ts";
import { toCoffeeOrder } from "#features/coffee-shop/api/order-mapping.ts";
import { Feed, feedFor } from "#app/feed.ts";
import { Message } from "../message.ts";
import { type Model, viewerOf } from "#app/model.ts";
import type { AppServices } from "#app/resources.ts";

const Connection = Schema.Struct({ userId: Schema.String, feed: Feed });
type Connection = typeof Connection.Type;

const connectionFor = (model: Model): Option.Option<Connection> => {
  const viewer = viewerOf(model);
  return Option.map(feedFor(viewer, model.route), (feed) => ({
    userId: viewer.kind === "anonymous" ? "" : viewer.userId,
    feed,
  }));
};

/** Oldest first, so the staff queue reads in the order the tickets were placed. */
const loaded = (connection: Connection, orders: ReadonlyArray<CoffeeOrder>): Message =>
  Message.LoadedOrders({
    feed: connection.feed,
    userId: connection.userId,
    orders: Array.sortWith(
      orders,
      (order) => DateTime.toEpochMillis(order.createdAt),
      Order.Number,
    ).map(toCoffeeOrder),
  });

const failed = (connection: Connection): Message =>
  Message.FailedOrders({
    feed: connection.feed,
    userId: connection.userId,
    message: "Live updates disconnected. Reconnecting...",
  });

/** The view behind a feed, watched over a WebSocket: its state now, then on every commit. */
const watch = (feed: Feed) =>
  Match.value(feed).pipe(
    Match.tagsExhaustive({
      CustomerOrders: ({ customerId }) =>
        Stream.unwrap(
          Effect.map(CustomerApi.Client, (client) =>
            client.CustomerOrders.watch(CustomerId.make(customerId)),
          ),
        ),
      OrderQueue: () =>
        Stream.unwrap(Effect.map(StaffApi.Client, (client) => client.OrderQueue.watch(mainShop))),
    }),
  );

/** One live read of the feed: a message for each state it reaches. */
const connect = (connection: Connection) =>
  watch(connection.feed).pipe(Stream.map(({ state }) => loaded(connection, state?.orders ?? [])));

const backoff = Schedule.exponential("250 millis").pipe(
  Schedule.modifyDelay(({ duration }) =>
    Effect.succeed(Duration.min(duration, Duration.seconds(5))),
  ),
);

/** Live orders, reconnected after every drop with a growing pause. */
const observe = (connection: Connection) =>
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
  // Listens from the moment the worker exists, so no download progress or crash is missed.
  assistantWorker: entry(
    { workerAcquired: Schema.Boolean },
    {
      modelToDependencies: (model) => ({ workerAcquired: model.assistant.workerAcquired }),
      dependenciesToStream: ({ workerAcquired }) =>
        workerAcquired
          ? workerNotices.pipe(
              Stream.map((notice) =>
                notice._tag === "Crashed"
                  ? Message.CrashedAssistantWorker({ message: notice.message })
                  : Message.ReportedModelProgress({
                      model: notice.model,
                      loaded: notice.loaded,
                      total: notice.total,
                    }),
              ),
            )
          : Stream.empty,
    },
  ),
}));

import type * as Domain from "@alchemy.run/domain";
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
  Ref,
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

/** A live list's pause before its next attempt: 250 ms, doubling, at most 5 s. */
const pauseAfter = (failures: number) =>
  Duration.min(Duration.millis(250 * 2 ** failures), Duration.seconds(5));

/**
 * Live orders, reconnected after every drop with a growing pause. The
 * disconnect Message is emitted inside the attempt, so it can never arrive
 * after the snapshot that replaced it, and a read that delivered its state
 * starts the pause over.
 */
const liveOrders = (
  connection: Connection,
): Stream.Stream<
  Message,
  never,
  Domain.Api.ClientKey<"CustomerApi"> | Domain.Api.ClientKey<"StaffApi">
> => {
  const attempt = (
    failures: number,
  ): Stream.Stream<
    Message,
    never,
    Domain.Api.ClientKey<"CustomerApi"> | Domain.Api.ClientKey<"StaffApi">
  > =>
    Stream.unwrap(
      Effect.map(Ref.make(false), (delivered) =>
        connect(connection).pipe(
          Stream.tap(() => Ref.set(delivered, true)),
          Stream.catchIf(
            () => true,
            () =>
              Stream.unwrap(
                Effect.map(Ref.get(delivered), (did) =>
                  Stream.make(failed(connection)).pipe(
                    Stream.concat(
                      Stream.fromEffectDrain(Effect.sleep(pauseAfter(did ? 0 : failures))),
                    ),
                    Stream.concat(attempt(did ? 0 : failures + 1)),
                  ),
                ),
              ),
            // Unreachable: the predicate keeps every failure. It tells the type
            // checker this stream never fails, so callers need no error arm.
            () => Stream.empty,
          ),
        ),
      ),
    );
  return attempt(0);
};

export const subscriptions = Subscription.make<Model, Message, AppServices>()((entry) => ({
  orders: entry(
    { connection: Schema.Option(Connection) },
    {
      modelToDependencies: (model) => ({ connection: connectionFor(model) }),
      dependenciesToStream: ({ connection }) =>
        Option.match(connection, { onNone: () => Stream.empty, onSome: liveOrders }),
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

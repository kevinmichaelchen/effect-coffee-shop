import { Client } from "@yielded/sync/client";
import { FeedId, OrderFeed } from "@effect-coffee-shop/coffee-domain/Order/OrderFeed";
import { Effect, Layer, Option, Schema, Stream, Schedule } from "effect";
import * as Socket from "effect/socket/Socket";
import { AsyncData, Subscription } from "foldkit";
import { Model } from "./model.ts";
import { Message } from "./message.ts";
const definition = Client.definition(OrderFeed, {
  applyEvent: (snapshot, event) => ({
    orders: [...snapshot.orders.filter((order) => order.id !== event.order.id), event.order],
  }),
});
const Connection = Schema.Struct({ userId: Schema.String, feedId: FeedId });
const observe = (connection: typeof Connection.Type) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const session = yield* Client.make(definition, { persistence: { mode: "volatile" } });
      const lease = yield* session.open(OrderFeed.address(connection.feedId));
      yield* lease.ready;
      return lease
        .select((snapshot) => snapshot.orders)
        .changes.pipe(
          Stream.flatMap((value) =>
            Option.match(value, {
              onNone: () => Stream.empty,
              onSome: (orders) => Stream.make(Message.LoadedOrders({ orders })),
            }),
          ),
        );
    }),
  ).pipe(
    Stream.provide(
      Client.layerWebSocketTransport(OrderFeed, {
        origin: location.origin,
        id: connection.feedId,
      }).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal)),
    ),
    Stream.provideService(Client.CurrentActor, { actorId: connection.userId }),
    // End the scoped transport too: the next connection authenticates its cookie again.
    Stream.interruptWhen(Effect.sleep("25 seconds")),
    Stream.repeat(Schedule.spaced("100 millis")),
    Stream.catch(() =>
      Stream.make(
        Message.FailedRequest({ error: "Live updates disconnected. Retry to reconnect." }),
      ),
    ),
  );
export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  orders: entry(
    { epoch: Schema.Natural, connection: Schema.Option(Connection) },
    {
      modelToDependencies: (model) => ({
        epoch: model.feedEpoch,
        connection: Option.flatMap(AsyncData.getData(model.viewer), (viewer) =>
          viewer.kind === "anonymous" || (model.page === "staff" && viewer.kind !== "staff")
            ? Option.none()
            : Option.some({
                userId: viewer.userId,
                feedId: FeedId.make(model.page === "staff" ? "staff" : `customer:${viewer.userId}`),
              }),
        ),
      }),
      dependenciesToStream: ({ connection }) =>
        Option.match(connection, { onNone: () => Stream.empty, onSome: observe }),
    },
  ),
}));

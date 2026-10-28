import { Duration, Option, Schema, Stream } from "effect";
import { Subscription } from "foldkit";
import { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";
import { ordersSource } from "#app/update.ts";

const ordersRefreshInterval = Duration.seconds(4);

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  refreshOrders: entry(
    { source: Schema.Literals(["customer", "staff", "none"]), userId: Schema.String },
    {
      modelToDependencies: (model) => ({
        source: Option.getOrElse(ordersSource(model), () => "none" as const),
        userId: model.viewer.kind === "anonymous" ? "" : model.viewer.userId,
      }),
      dependenciesToStream: ({ source }) =>
        source === "none"
          ? Stream.empty
          : Stream.tick(ordersRefreshInterval).pipe(
              Stream.drop(1),
              Stream.map(() => Message.TickedOrdersRefresh()),
            ),
    },
  ),
}));

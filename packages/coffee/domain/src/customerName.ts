import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { Actor } from "./Actor.ts";
import { InvalidOrder } from "./Menu/InvalidOrder.rejection.ts";
import { CustomerName } from "./Menu/OrderPrimitives.ts";

const decodeCustomerName = Schema.decodeUnknownEffect(CustomerName);

/** The name on a ticket: customers and staff order as themselves; the system may name the customer. */
export const customerNameFor = (
  actor: Actor,
  requested: Option.Option<string>,
): Effect.Effect<CustomerName, InvalidOrder> =>
  decodeCustomerName(
    actor.kind === "system"
      ? Option.getOrElse(requested, () => actor.displayName)
      : actor.displayName,
  ).pipe(Effect.mapError(() => new InvalidOrder({ message: "customerName must not be blank" })));

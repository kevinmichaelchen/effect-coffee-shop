import * as Domain from "@alchemy.run/domain";
import * as Effect from "effect/Effect";
import { Session } from "../Session.middleware.ts";
import { Cart, CartState, cartEvolve, mustOwn } from "./Cart.aggregate.ts";
import { NotYourCart } from "./NotYourCart.rejection.ts";

/**
 * A customer's cart as they see it: its lines and any checkout awaiting
 * confirmation. Clients never read the Cart aggregate itself, so this view
 * folds the same events into the same state. Only the owner may read it.
 */
export class CustomerCart extends Domain.View("CustomerCart", {
  from: [Cart],
  key: Cart,
  middleware: [Session],
  rejects: [NotYourCart],
  state: CartState,
  initial: { lines: [], checkout: null },
  evolve: cartEvolve,
}) {}

export const CustomerCartLive = CustomerCart.toLayer(
  Effect.sync(() => (request) => mustOwn(request.key.id)),
);

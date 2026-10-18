import * as Domain from "alchemy/Domain";
import * as Schema from "effect/Schema";
import { CustomerId } from "../Customer/Customer.id.ts";
import { DrinkNotFound } from "../Menu/DrinkNotFound.rejection.ts";
import { InvalidOrder } from "../Menu/InvalidOrder.rejection.ts";
import { CoffeeOrderItem, DrinkSelection } from "../Menu/OrderItem.ts";
import { CustomerName } from "../Menu/OrderPrimitives.ts";
import { Money } from "../Money.ts";
import { Session } from "../Session.middleware.ts";
import { CoffeeOrder } from "./CoffeeOrder.ts";
import { OrderId } from "./Order.id.ts";

export class AlreadyPlaced extends Domain.Rejection("AlreadyPlaced", { orderId: OrderId }) {}

/** A customer's order joined the queue, priced. */
export class OrderPlaced extends Domain.Event(
  "OrderPlaced",
  {
    customerId: CustomerId,
    customerName: CustomerName,
    items: Schema.NonEmptyArray(CoffeeOrderItem),
    totalPrice: Money,
  },
  { attributes: (e) => ({ "coffee.items": e.items.length }) },
) {}

/**
 * Place an order for the signed-in actor. Staff and customers order under
 * their own name; the system may name the customer.
 */
export class PlaceOrder extends Domain.Command("PlaceOrder", {
  target: OrderId,
  middleware: [Session],
  input: {
    items: Schema.Array(DrinkSelection),
    customerName: Schema.optionalKey(
      Schema.Trim.annotate({ description: "Customer display name, for system orders." }),
    ),
  },
  events: [OrderPlaced],
  rejects: [AlreadyPlaced, DrinkNotFound, InvalidOrder],
  reply: { order: CoffeeOrder },
  attributes: (cmd) => ({ "coffee.items": cmd.items.length }),
}) {}

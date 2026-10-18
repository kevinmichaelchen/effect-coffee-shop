import * as Domain from "alchemy/Domain";
import { Checkout } from "../Cart/Checkout.ts";
import { CustomerId } from "../Customer/Customer.id.ts";
import { CustomerName } from "../Menu/OrderPrimitives.ts";
import { OrderId } from "./Order.id.ts";
import { OrderPlaced } from "./PlaceOrder.command.ts";

/**
 * Place the order a customer confirmed at checkout, at the prices they saw.
 * Sent by `CheckoutFulfillment`; placing it again changes nothing.
 */
export class PlaceCheckedOutOrder extends Domain.Command("PlaceCheckedOutOrder", {
  target: OrderId,
  input: {
    customerId: CustomerId,
    customerName: CustomerName,
    checkout: Checkout,
  },
  events: [OrderPlaced],
}) {}

import * as Domain from "@alchemy.run/domain";
import { Actor } from "../Actor.ts";
import { Session } from "../Session.middleware.ts";
import { StaffOnly } from "../StaffOnly.rejection.ts";
import { CoffeeOrder } from "./CoffeeOrder.ts";
import { InvalidStatusTransition } from "./InvalidStatusTransition.rejection.ts";
import { OrderId } from "./Order.id.ts";
import { OrderNotFound } from "./OrderNotFound.rejection.ts";

/** The order moved to `cancelled`, by a member of staff. */
export class OrderCancelled extends Domain.Event("OrderCancelled", { by: Actor }) {}

/** Cancel an order that is pending or brewing. Staff only. */
export class CancelOrder extends Domain.Command("CancelOrder", {
  target: OrderId,
  middleware: [Session],
  events: [OrderCancelled],
  rejects: [StaffOnly, OrderNotFound, InvalidStatusTransition],
  reply: { order: CoffeeOrder },
}) {}

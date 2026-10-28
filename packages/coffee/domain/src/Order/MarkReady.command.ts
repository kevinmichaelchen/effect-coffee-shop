import * as Domain from "@alchemy.run/domain";
import { Actor } from "../Actor.ts";
import { Session } from "../Session.middleware.ts";
import { StaffOnly } from "../StaffOnly.rejection.ts";
import { CoffeeOrder } from "./CoffeeOrder.ts";
import { InvalidStatusTransition } from "./InvalidStatusTransition.rejection.ts";
import { OrderId } from "./Order.id.ts";
import { OrderNotFound } from "./OrderNotFound.rejection.ts";

/** The order moved to `ready`, by a member of staff. */
export class OrderReady extends Domain.Event("OrderReady", { by: Actor }) {}

/** Mark a brewing order ready for pickup. Staff only. */
export class MarkReady extends Domain.Command("MarkReady", {
  target: OrderId,
  middleware: [Session],
  events: [OrderReady],
  rejects: [StaffOnly, OrderNotFound, InvalidStatusTransition],
  reply: { order: CoffeeOrder },
}) {}

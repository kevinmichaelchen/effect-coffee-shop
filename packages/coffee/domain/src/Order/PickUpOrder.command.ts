import * as Domain from "alchemy/Domain";
import { Actor } from "../Actor.ts";
import { Session } from "../Session.middleware.ts";
import { StaffOnly } from "../StaffOnly.rejection.ts";
import { CoffeeOrder } from "./CoffeeOrder.ts";
import { InvalidStatusTransition } from "./InvalidStatusTransition.rejection.ts";
import { OrderId } from "./Order.id.ts";
import { OrderNotFound } from "./OrderNotFound.rejection.ts";

/** The order moved to `picked-up`, by a member of staff. */
export class OrderPickedUp extends Domain.Event("OrderPickedUp", { by: Actor }) {}

/** Hand a ready order to its customer. Staff only. */
export class PickUpOrder extends Domain.Command("PickUpOrder", {
  target: OrderId,
  middleware: [Session],
  events: [OrderPickedUp],
  rejects: [StaffOnly, OrderNotFound, InvalidStatusTransition],
  reply: { order: CoffeeOrder },
}) {}

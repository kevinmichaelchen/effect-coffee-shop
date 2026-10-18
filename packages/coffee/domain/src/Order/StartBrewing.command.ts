import * as Domain from "alchemy/Domain";
import { Actor } from "../Actor.ts";
import { Session } from "../Session.middleware.ts";
import { StaffOnly } from "../StaffOnly.rejection.ts";
import { CoffeeOrder } from "./CoffeeOrder.ts";
import { InvalidStatusTransition } from "./InvalidStatusTransition.rejection.ts";
import { OrderId } from "./Order.id.ts";
import { OrderNotFound } from "./OrderNotFound.rejection.ts";

/** The order moved to `brewing`, by a member of staff. */
export class BrewingStarted extends Domain.Event("BrewingStarted", { by: Actor }) {}

/** Start brewing a pending order. Staff only. */
export class StartBrewing extends Domain.Command("StartBrewing", {
  target: OrderId,
  middleware: [Session],
  events: [BrewingStarted],
  rejects: [StaffOnly, OrderNotFound, InvalidStatusTransition],
  reply: { order: CoffeeOrder },
}) {}

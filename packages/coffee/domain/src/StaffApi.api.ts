import * as Domain from "alchemy/Domain";
import { CancelOrder } from "./Order/CancelOrder.command.ts";
import { MarkReady } from "./Order/MarkReady.command.ts";
import { OrderQueue } from "./Order/OrderQueue.view.ts";
import { OrderSummary } from "./Order/OrderSummary.view.ts";
import { PickUpOrder } from "./Order/PickUpOrder.command.ts";
import { StartBrewing } from "./Order/StartBrewing.command.ts";

/** What the barista app reaches: the queue, any ticket, and the lifecycle commands. */
export class StaffApi extends Domain.Api(
  "StaffApi",
  StartBrewing,
  MarkReady,
  PickUpOrder,
  CancelOrder,
  OrderQueue,
  OrderSummary,
) {}

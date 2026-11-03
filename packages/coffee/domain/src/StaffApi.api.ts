import * as Domain from "@alchemy.run/domain";
import { CoffeeShop } from "./CoffeeShop.model.ts";

/** What the barista app reaches: the queue, any ticket, and the lifecycle commands. */
export class StaffApi extends Domain.Api("StaffApi", {
  model: CoffeeShop,
  commands: ["StartBrewing", "MarkReady", "PickUpOrder", "CancelOrder"],
  views: ["OrderQueue", "OrderSummary"],
  streams: [],
  aggregates: [],
}) {}

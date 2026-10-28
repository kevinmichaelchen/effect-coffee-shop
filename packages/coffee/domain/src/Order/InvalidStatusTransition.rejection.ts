import * as Domain from "@alchemy.run/domain";
import { OrderId } from "./Order.id.ts";
import { OrderStatus } from "./OrderStatus.ts";

/** The lifecycle does not allow this move from the order's current status. */
export class InvalidStatusTransition extends Domain.Rejection("InvalidStatusTransition", {
  orderId: OrderId,
  from: OrderStatus,
  to: OrderStatus,
}) {}

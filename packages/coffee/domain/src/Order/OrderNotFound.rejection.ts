import * as Domain from "@alchemy.run/domain";
import { OrderId } from "./Order.id.ts";

/** No order was placed with this id. */
export class OrderNotFound extends Domain.Rejection("OrderNotFound", { orderId: OrderId }) {}

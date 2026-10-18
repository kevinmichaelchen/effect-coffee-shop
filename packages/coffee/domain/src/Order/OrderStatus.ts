/**
 * The order lifecycle the baristas drive.
 *
 * ```mermaid
 * stateDiagram-v2
 *     state "picked-up" as pickedUp
 *     [*] --> pending
 *     pending --> brewing: StartBrewing
 *     pending --> cancelled: CancelOrder
 *     brewing --> ready: MarkReady
 *     brewing --> cancelled: CancelOrder
 *     ready --> pickedUp: PickUpOrder
 * ```
 *
 * @module
 */
import * as Schema from "effect/Schema";

export const orderStatuses = ["pending", "brewing", "ready", "picked-up", "cancelled"] as const;
export const OrderStatus = Schema.Literals(orderStatuses);
export type OrderStatus = typeof OrderStatus.Type;

const next: Readonly<Record<OrderStatus, ReadonlyArray<OrderStatus>>> = {
  pending: ["brewing", "cancelled"],
  brewing: ["ready", "cancelled"],
  ready: ["picked-up"],
  "picked-up": [],
  cancelled: [],
};

/** Whether the lifecycle allows moving from one status to another. */
export const canTransitionTo = (from: OrderStatus, to: OrderStatus): boolean =>
  next[from].includes(to);

/** Orders still in the queue: not picked up and not cancelled. */
export const isOpen = (status: OrderStatus): boolean =>
  status !== "picked-up" && status !== "cancelled";

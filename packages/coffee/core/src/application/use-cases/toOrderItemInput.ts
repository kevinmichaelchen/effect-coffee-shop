/**
 * Converts resolved/cart item shapes back to order item requests.
 *
 * @module
 */
import * as Option from "effect/Option";
import type { OrderItemInput } from "../contracts.ts";

export const toOrderItemInput = (item: {
  readonly drinkId: string;
  readonly milk: Option.Option<string>;
  readonly notes: Option.Option<string>;
  readonly quantity: number;
  readonly shots: Option.Option<number>;
  readonly size: string;
  readonly temperature: Option.Option<string>;
}): OrderItemInput => ({
  drinkId: item.drinkId,
  size: item.size,
  quantity: item.quantity,
  ...Option.match(item.milk, {
    onNone: () => ({}),
    onSome: (milk) => ({ milk }),
  }),
  ...Option.match(item.temperature, {
    onNone: () => ({}),
    onSome: (temperature) => ({ temperature }),
  }),
  ...Option.match(item.shots, {
    onNone: () => ({}),
    onSome: (shots) => ({ shots }),
  }),
  ...Option.match(item.notes, {
    onNone: () => ({}),
    onSome: (notes) => ({ notes }),
  }),
});

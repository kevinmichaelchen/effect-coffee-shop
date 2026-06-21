/**
 * Shared MCP order selection helpers.
 *
 * @module
 */
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import type { CoffeeOrder } from "@effect-coffee-shop/coffee-core/domain/order";

type CoffeeOrderAppService = Context.Service.Shape<typeof CoffeeOrderApp>;

const isOpenOrder = (order: CoffeeOrder) =>
  order.status !== "picked-up" && order.status !== "cancelled";

export const listOpenOrders = (app: CoffeeOrderAppService) =>
  app.listOrders({}).pipe(Effect.map((orders) => orders.filter(isOpenOrder)));

import { MenuSchema } from "@effect-coffee-shop/coffee-core/domain/menu";
import {
  CoffeeOrderSchema,
  CoffeeOrdersSchema,
} from "@effect-coffee-shop/coffee-core/domain/order";
import {
  ListOrdersRequestSchema,
  PlaceOrderRequestSchema,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import { AppErrorSchema, EmptyActionInputSchema, OrderIdActionInputSchema } from "./schemas.ts";

export const coffeeActionSpecs = {
  list_menu: {
    description: "List the current coffee menu",
    parameters: EmptyActionInputSchema,
    success: MenuSchema,
    failure: AppErrorSchema,
  },
  place_order: {
    description: "Create a new coffee order",
    parameters: PlaceOrderRequestSchema,
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
  get_order: {
    description: "Fetch one order by id",
    parameters: OrderIdActionInputSchema,
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
  list_orders: {
    description: "List orders, optionally filtered by status",
    parameters: ListOrdersRequestSchema,
    success: CoffeeOrdersSchema,
    failure: AppErrorSchema,
  },
  start_brewing: {
    description: "Move an order from pending to brewing",
    parameters: OrderIdActionInputSchema,
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
  mark_ready: {
    description: "Move an order from brewing to ready",
    parameters: OrderIdActionInputSchema,
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
  pick_up_order: {
    description: "Move an order from ready to picked-up",
    parameters: OrderIdActionInputSchema,
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
  cancel_order: {
    description: "Cancel a pending or brewing order",
    parameters: OrderIdActionInputSchema,
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
} as const;

export type CoffeeActionName = keyof typeof coffeeActionSpecs;

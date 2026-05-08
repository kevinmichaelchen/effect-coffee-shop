import * as Schema from "effect/Schema";
import { MenuSchema } from "@effect-coffee-shop/coffee-core/domain/menu";
import {
  CoffeeOrderSchema,
  CoffeeOrdersSchema,
  OrderIdSchema,
} from "@effect-coffee-shop/coffee-core/domain/order";
import {
  ListOrdersRequestSchema,
  PlaceOrderRequestSchema,
} from "@effect-coffee-shop/coffee-core/service/contracts";
import { AppErrorSchema } from "./schemas.ts";

const EmptyParamsSchema = Schema.Struct({});

export const coffeeMcpActionSpecs = {
  list_menu: {
    description: "List the current coffee menu",
    parameters: EmptyParamsSchema,
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
    parameters: Schema.Struct({
      orderId: OrderIdSchema,
    }),
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
    parameters: Schema.Struct({
      orderId: OrderIdSchema,
    }),
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
  mark_ready: {
    description: "Move an order from brewing to ready",
    parameters: Schema.Struct({
      orderId: OrderIdSchema,
    }),
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
  pick_up_order: {
    description: "Move an order from ready to picked-up",
    parameters: Schema.Struct({
      orderId: OrderIdSchema,
    }),
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
  cancel_order: {
    description: "Cancel a pending or brewing order",
    parameters: Schema.Struct({
      orderId: OrderIdSchema,
    }),
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
} as const;

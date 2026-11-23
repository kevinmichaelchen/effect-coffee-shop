import * as Domain from "@alchemy.run/domain";
import * as Layer from "effect/Layer";
import { Cart } from "./Cart/Cart.aggregate.ts";
import { CheckoutFulfillment } from "./Cart/CheckoutFulfillment.decision.ts";
import { CustomerCart, CustomerCartLive } from "./Cart/CustomerCart.view.ts";
import { Customer } from "./Customer/Customer.aggregate.ts";
import { CustomerOrders, CustomerOrdersLive } from "./Order/CustomerOrders.view.ts";
import { Order } from "./Order/Order.aggregate.ts";
import { OrderQueue, OrderQueueLive } from "./Order/OrderQueue.view.ts";
import { OrderSummary, OrderSummaryLive } from "./Order/OrderSummary.view.ts";

/** The coffee shop: every aggregate, view and policy, hosted together. */
export const coffeeShopMembers = {
  aggregates: [Order, Cart, Customer],
  views: [OrderSummary, CustomerOrders, OrderQueue, CustomerCart],
  decisions: [CheckoutFulfillment],
};

export class CoffeeShop extends Domain.Model("CoffeeShop", coffeeShopMembers) {}

/** Every read guard, as one Layer. */
export const CoffeeShopHandlers = Layer.mergeAll(
  OrderSummaryLive,
  CustomerOrdersLive,
  OrderQueueLive,
  CustomerCartLive,
);

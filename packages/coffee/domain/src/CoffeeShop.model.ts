import * as Domain from "alchemy/Domain";
import * as Layer from "effect/Layer";
import { Cart } from "./Cart/Cart.aggregate.ts";
import { CheckoutFulfillment, CheckoutFulfillmentLive } from "./Cart/CheckoutFulfillment.policy.ts";
import { Customer } from "./Customer/Customer.aggregate.ts";
import { CustomerOrders } from "./Order/CustomerOrders.view.ts";
import { Order } from "./Order/Order.aggregate.ts";
import { OrderQueue } from "./Order/OrderQueue.view.ts";
import { OrderSummary } from "./Order/OrderSummary.view.ts";
import { Shop } from "./Shop/Shop.aggregate.ts";

/** The coffee shop: every aggregate, view and policy, hosted together. */
export class CoffeeShop extends Domain.Model("CoffeeShop", {
  aggregates: [Order, Cart, Customer, Shop],
  views: [OrderSummary, CustomerOrders, OrderQueue],
  policies: [CheckoutFulfillment],
}) {}

/** Every policy implementation, as one Layer. */
export const CoffeeShopHandlers = Layer.mergeAll(CheckoutFulfillmentLive);

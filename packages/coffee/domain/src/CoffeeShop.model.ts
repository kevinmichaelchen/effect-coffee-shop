import * as Domain from "@alchemy.run/domain";
import * as Layer from "effect/Layer";
import { Cart } from "./Cart/Cart.aggregate.ts";
import { CheckoutFulfillment, CheckoutFulfillmentLive } from "./Cart/CheckoutFulfillment.policy.ts";
import { Customer } from "./Customer/Customer.aggregate.ts";
import { FulfillCheckout, FulfillCheckoutLive } from "./Cart/FulfillCheckout.saga.ts";
import { CustomerOrders } from "./Order/CustomerOrders.view.ts";
import { Order } from "./Order/Order.aggregate.ts";
import { OrderQueue } from "./Order/OrderQueue.view.ts";
import { OrderSummary } from "./Order/OrderSummary.view.ts";
import { Shop } from "./Shop/Shop.aggregate.ts";

/** The coffee shop: every aggregate, view and policy, hosted together. */
export const coffeeShopMembers = {
  aggregates: [Order, Cart, Customer, Shop],
  views: [OrderSummary, CustomerOrders, OrderQueue],
  policies: [CheckoutFulfillment],
  sagas: [FulfillCheckout],
};

export class CoffeeShop extends Domain.Model("CoffeeShop", coffeeShopMembers) {}

/** Every policy and saga implementation, as one Layer. */
export const CoffeeShopHandlers = Layer.mergeAll(CheckoutFulfillmentLive, FulfillCheckoutLive);

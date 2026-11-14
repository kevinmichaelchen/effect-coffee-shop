import * as Domain from "@alchemy.run/domain";
import { CoffeeShop } from "./CoffeeShop.model.ts";

/**
 * What the customer app reaches: placing orders, the cart and its checkout,
 * and reads of their own orders. Each entry authorizes itself, through its
 * `decide` or its view's Layer.
 */
export class CustomerApi extends Domain.Api("CustomerApi", {
  model: CoffeeShop,
  commands: [
    "PlaceOrder",
    "AddCartItem",
    "UpdateCartItem",
    "RemoveCartItem",
    "ClearCart",
    "PrepareCheckout",
    "ConfirmCheckout",
  ],
  views: ["OrderSummary", "CustomerOrders", "CustomerCart"],
  streams: [],
}) {}

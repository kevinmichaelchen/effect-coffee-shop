import * as Domain from "alchemy/Domain";
import { AddCartItem } from "./Cart/AddCartItem.command.ts";
import { Cart } from "./Cart/Cart.aggregate.ts";
import { ClearCart } from "./Cart/ClearCart.command.ts";
import { ConfirmCheckout } from "./Cart/ConfirmCheckout.command.ts";
import { PrepareCheckout } from "./Cart/PrepareCheckout.command.ts";
import { RemoveCartItem } from "./Cart/RemoveCartItem.command.ts";
import { UpdateCartItem } from "./Cart/UpdateCartItem.command.ts";
import { CustomerOrders } from "./Order/CustomerOrders.view.ts";
import { OrderSummary } from "./Order/OrderSummary.view.ts";
import { PlaceOrder } from "./Order/PlaceOrder.command.ts";

/**
 * What the customer app reaches: placing orders, the cart and its checkout,
 * and reads of their own orders. Each entry authorizes itself, through its
 * `decide` or `validate`.
 */
export class CustomerApi extends Domain.Api(
  "CustomerApi",
  PlaceOrder,
  AddCartItem,
  UpdateCartItem,
  RemoveCartItem,
  ClearCart,
  PrepareCheckout,
  ConfirmCheckout,
  Cart,
  OrderSummary,
  CustomerOrders,
) {}

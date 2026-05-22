/**
 * Provides isolated JSON Schema parameter objects for assistant tools.
 *
 * @module
 */
import {
  cartItemIdActionJsonSchema,
  checkoutCartActionJsonSchema,
  emptyActionJsonSchema,
  getCheckoutSessionActionJsonSchema,
  itemOptionsActionJsonSchema,
  listOrdersActionJsonSchema,
  orderItemActionJsonSchema,
  orderIdActionJsonSchema,
  placeOrderActionJsonSchema,
  prepareCartCheckoutActionJsonSchema,
  quoteOrderActionJsonSchema,
  updateCartItemActionJsonSchema,
} from "@effect-coffee-shop/coffee-actions/json-schema";

export const emptyToolParameters = emptyActionJsonSchema;

export const orderIdToolParameters = orderIdActionJsonSchema;

export const cartItemIdToolParameters = cartItemIdActionJsonSchema;

export const checkoutCartToolParameters = checkoutCartActionJsonSchema;

export const prepareCartCheckoutToolParameters = prepareCartCheckoutActionJsonSchema;

export const getCheckoutSessionToolParameters = getCheckoutSessionActionJsonSchema;

export const itemOptionsToolParameters = itemOptionsActionJsonSchema;

export const listOrdersToolParameters = listOrdersActionJsonSchema;

export const orderItemToolParameters = orderItemActionJsonSchema;

export const placeOrderToolParameters = placeOrderActionJsonSchema;

export const quoteOrderToolParameters = quoteOrderActionJsonSchema;

export const updateCartItemToolParameters = updateCartItemActionJsonSchema;

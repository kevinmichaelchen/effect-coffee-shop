import * as R from "effect/Record";
/**
 * Derives Coffee action JSON Schema metadata from boundary schemas.
 *
 * @module
 */
import * as JsonSchema from "effect/JsonSchema";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";
import {
  CartItemIdRequest,
  CheckoutCartRequest,
  ItemOptionsRequest,
  ListOrdersRequest,
  OrderItemInput,
  PlaceOrderRequest,
  QuoteOrderRequest,
  UpdateCartItemRequest,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import { OrderIdActionInput } from "./schemas.ts";

export type CoffeeActionJsonSchema = JsonSchema.JsonSchema;

const EmptyActionInput = Schema.Record(Schema.String, Schema.Never);

function actionJsonSchema(schema: Schema.Top): CoffeeActionJsonSchema {
  const document = Schema.toJsonSchemaDocument(schema, { generateDescriptions: true });
  const definitions = document.definitions;

  return Match.value(R.keys(definitions).length).pipe(
    Match.when(0, () => document.schema),
    Match.orElse(() => ({
      ...document.schema,
      $defs: definitions,
    })),
  );
}

export const emptyActionJsonSchema = actionJsonSchema(EmptyActionInput);
export const prepareCartCheckoutActionJsonSchema = emptyActionJsonSchema;
export const getCheckoutSessionActionJsonSchema = emptyActionJsonSchema;
export const orderIdActionJsonSchema = actionJsonSchema(OrderIdActionInput);
export const itemOptionsActionJsonSchema = actionJsonSchema(ItemOptionsRequest);
export const listOrdersActionJsonSchema = actionJsonSchema(ListOrdersRequest);
export const placeOrderActionJsonSchema = actionJsonSchema(PlaceOrderRequest);
export const quoteOrderActionJsonSchema = actionJsonSchema(QuoteOrderRequest);
export const orderItemActionJsonSchema = actionJsonSchema(OrderItemInput);
export const updateCartItemActionJsonSchema = actionJsonSchema(UpdateCartItemRequest);
export const cartItemIdActionJsonSchema = actionJsonSchema(CartItemIdRequest);
export const checkoutCartActionJsonSchema = actionJsonSchema(CheckoutCartRequest);

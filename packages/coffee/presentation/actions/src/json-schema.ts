/**
 * Derives Coffee action JSON Schema metadata from boundary schemas.
 *
 * @module
 */
import * as JsonSchema from "effect/JsonSchema";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";
import {
  CartItemIdRequestSchema,
  CheckoutCartRequestSchema,
  ItemOptionsRequestSchema,
  ListOrdersRequestSchema,
  OrderItemInputSchema,
  PlaceOrderRequestSchema,
  QuoteOrderRequestSchema,
  UpdateCartItemRequestSchema,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import { OrderIdActionInputSchema } from "./schemas.ts";

export type CoffeeActionJsonSchema = JsonSchema.JsonSchema;

const EmptyActionInputSchema = Schema.Record(Schema.String, Schema.Never);

function actionJsonSchema(schema: Schema.Top): CoffeeActionJsonSchema {
  const document = JsonSchema.resolveTopLevel$ref(
    Schema.toJsonSchemaDocument(schema, { generateDescriptions: true }),
  );
  const definitions = document.definitions;

  return Match.value(Object.keys(definitions).length).pipe(
    Match.when(0, () => document.schema),
    Match.orElse(() => ({
      ...document.schema,
      $defs: definitions,
    })),
  );
}

export const emptyActionJsonSchema = actionJsonSchema(EmptyActionInputSchema);
export const prepareCartCheckoutActionJsonSchema = emptyActionJsonSchema;
export const getCheckoutSessionActionJsonSchema = emptyActionJsonSchema;
export const orderIdActionJsonSchema = actionJsonSchema(OrderIdActionInputSchema);
export const itemOptionsActionJsonSchema = actionJsonSchema(ItemOptionsRequestSchema);
export const listOrdersActionJsonSchema = actionJsonSchema(ListOrdersRequestSchema);
export const placeOrderActionJsonSchema = actionJsonSchema(PlaceOrderRequestSchema);
export const quoteOrderActionJsonSchema = actionJsonSchema(QuoteOrderRequestSchema);
export const orderItemActionJsonSchema = actionJsonSchema(OrderItemInputSchema);
export const updateCartItemActionJsonSchema = actionJsonSchema(UpdateCartItemRequestSchema);
export const cartItemIdActionJsonSchema = actionJsonSchema(CartItemIdRequestSchema);
export const checkoutCartActionJsonSchema = actionJsonSchema(CheckoutCartRequestSchema);

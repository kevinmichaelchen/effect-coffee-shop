/**
 * Exposes Coffee application actions as assistant-callable tools.
 *
 * @module
 */
import { type CoffeeActionName, coffeeActionSpecs } from "@effect-coffee-shop/coffee-actions/specs";
import {
  executeCoffeeAction,
  type CoffeeAppRunner,
} from "@effect-coffee-shop/coffee-actions/execute";
import * as Effect from "effect/Effect";
import type { AssistantToolActivity, AssistantToolDefinition } from "../application/model.ts";
import {
  formatToolFailure,
  formatToolPayload,
  serializeToolResult,
} from "@effect-coffee-shop/coffee-actions/format";
import {
  cartItemIdToolParameters,
  checkoutCartToolParameters,
  emptyToolParameters,
  getCheckoutSessionToolParameters,
  itemOptionsToolParameters,
  listOrdersToolParameters,
  orderItemToolParameters,
  orderIdToolParameters,
  placeOrderToolParameters,
  prepareCartCheckoutToolParameters,
  quoteOrderToolParameters,
  updateCartItemToolParameters,
} from "./parameters.ts";

export function getAssistantToolActivityEvent(): string {
  return "assistant_tool_activity";
}

type AssistantToolEmitter = (activity: AssistantToolActivity) => void;

const assistantToolInput = (
  action: CoffeeActionName,
  parameters: AssistantToolDefinition["parameters"],
) => ({
  action,
  description: coffeeActionSpecs[action].description,
  name: action,
  parameters,
});

const assistantToolInputs = [
  assistantToolInput("place_order", placeOrderToolParameters),
  assistantToolInput("add_cart_item", orderItemToolParameters),
  assistantToolInput("prepare_cart_checkout", prepareCartCheckoutToolParameters),
  assistantToolInput("get_checkout_session", getCheckoutSessionToolParameters),
  assistantToolInput("checkout_cart", checkoutCartToolParameters),
  assistantToolInput("get_cart", emptyToolParameters),
  assistantToolInput("update_cart_item", updateCartItemToolParameters),
  assistantToolInput("remove_cart_item", cartItemIdToolParameters),
  assistantToolInput("clear_cart", emptyToolParameters),
  assistantToolInput("list_menu", emptyToolParameters),
  assistantToolInput("get_item_options", itemOptionsToolParameters),
  assistantToolInput("validate_order", quoteOrderToolParameters),
  assistantToolInput("quote_order", quoteOrderToolParameters),
  assistantToolInput("get_order", orderIdToolParameters),
  assistantToolInput("list_orders", listOrdersToolParameters),
  assistantToolInput("start_brewing", orderIdToolParameters),
  assistantToolInput("mark_ready", orderIdToolParameters),
  assistantToolInput("pick_up_order", orderIdToolParameters),
  assistantToolInput("cancel_order", orderIdToolParameters),
];

export function createCoffeeAssistantTools(
  runApp: CoffeeAppRunner,
  emitActivity: AssistantToolEmitter,
) {
  return assistantToolInputs.map((input) =>
    createAppTool({
      ...input,
      emitActivity,
      runApp,
    }),
  );
}

function createAppTool(input: {
  readonly action: CoffeeActionName;
  readonly description: string;
  readonly emitActivity: AssistantToolEmitter;
  readonly name: string;
  readonly parameters: AssistantToolDefinition["parameters"];
  readonly runApp: CoffeeAppRunner;
}): AssistantToolDefinition {
  const { action, description, emitActivity, name, parameters, runApp } = input;

  return {
    description,
    execute: (toolInput) =>
      Effect.gen(function* () {
        emitActivity({
          detail: formatToolPayload(toolInput),
          kind: "tool-call",
          label: name,
        });

        return yield* Effect.tryPromise({
          try: () =>
            executeCoffeeAction({
              action,
              payload: toolInput,
              runApp,
            }),
          catch: (error) => error,
        }).pipe(
          Effect.match({
            onFailure: (error) => {
              const detail = formatToolFailure(error);

              emitActivity({
                detail,
                kind: "tool-result",
                label: name,
              });

              return detail;
            },
            onSuccess: (output) => {
              const serializedOutput = serializeToolResult(output);

              emitActivity({
                detail: formatToolPayload(output),
                kind: "tool-result",
                label: name,
              });

              return serializedOutput;
            },
          }),
        );
      }),
    name,
    parameters,
  };
}

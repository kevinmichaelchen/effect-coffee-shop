import type { CoffeeActionName } from "@effect-coffee-shop/coffee-actions/specs";
import {
  executeCoffeeAction,
  type CoffeeAppRunner,
} from "@effect-coffee-shop/coffee-actions/execute";
import {
  AddCartItemTool,
  CancelOrderTool,
  CheckoutCartTool,
  ClearCartTool,
  GetOrderTool,
  GetCartTool,
  GetItemOptionsTool,
  ListMenuTool,
  ListOrdersTool,
  MarkReadyTool,
  PickUpOrderTool,
  PlaceOrderTool,
  QuoteOrderTool,
  RemoveCartItemTool,
  StartBrewingTool,
  UpdateCartItemTool,
  ValidateOrderTool,
} from "@effect-coffee-shop/coffee-actions/toolkit";
import * as Effect from "effect/Effect";
import * as Tool from "effect/unstable/ai/Tool";
import type { AssistantToolActivity, AssistantToolDefinition } from "../model.ts";
import {
  formatToolFailure,
  formatToolPayload,
  serializeToolResult,
} from "@effect-coffee-shop/coffee-actions/format";
import {
  cartItemIdToolParameters,
  checkoutCartToolParameters,
  emptyToolParameters,
  itemOptionsToolParameters,
  listOrdersToolParameters,
  orderItemToolParameters,
  orderIdToolParameters,
  placeOrderToolParameters,
  quoteOrderToolParameters,
  updateCartItemToolParameters,
} from "./parameters.ts";

export function getAssistantToolActivityEvent(): string {
  return "assistant_tool_activity";
}

type AssistantToolEmitter = (activity: AssistantToolActivity) => void;

const assistantToolInputs = [
  { action: "list_menu", parameters: emptyToolParameters, tool: ListMenuTool },
  { action: "get_item_options", parameters: itemOptionsToolParameters, tool: GetItemOptionsTool },
  { action: "validate_order", parameters: quoteOrderToolParameters, tool: ValidateOrderTool },
  { action: "quote_order", parameters: quoteOrderToolParameters, tool: QuoteOrderTool },
  { action: "place_order", parameters: placeOrderToolParameters, tool: PlaceOrderTool },
  { action: "get_order", parameters: orderIdToolParameters, tool: GetOrderTool },
  { action: "list_orders", parameters: listOrdersToolParameters, tool: ListOrdersTool },
  { action: "start_brewing", parameters: orderIdToolParameters, tool: StartBrewingTool },
  { action: "mark_ready", parameters: orderIdToolParameters, tool: MarkReadyTool },
  { action: "pick_up_order", parameters: orderIdToolParameters, tool: PickUpOrderTool },
  { action: "cancel_order", parameters: orderIdToolParameters, tool: CancelOrderTool },
  { action: "get_cart", parameters: emptyToolParameters, tool: GetCartTool },
  { action: "add_cart_item", parameters: orderItemToolParameters, tool: AddCartItemTool },
  {
    action: "update_cart_item",
    parameters: updateCartItemToolParameters,
    tool: UpdateCartItemTool,
  },
  { action: "remove_cart_item", parameters: cartItemIdToolParameters, tool: RemoveCartItemTool },
  { action: "clear_cart", parameters: emptyToolParameters, tool: ClearCartTool },
  { action: "checkout_cart", parameters: checkoutCartToolParameters, tool: CheckoutCartTool },
] as const satisfies readonly {
  readonly action: CoffeeActionName;
  readonly parameters: AssistantToolDefinition["parameters"];
  readonly tool: Tool.Any;
}[];

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
  readonly emitActivity: AssistantToolEmitter;
  readonly parameters: AssistantToolDefinition["parameters"];
  readonly runApp: CoffeeAppRunner;
  readonly tool: Tool.Any;
}): AssistantToolDefinition {
  const { action, emitActivity, parameters, runApp, tool } = input;
  const name = tool.name;

  return {
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
    parameters,
    tool,
  };
}

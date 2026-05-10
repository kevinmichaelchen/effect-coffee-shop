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
import * as Match from "effect/Match";
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
type OrderStateActionName = "cancel_order" | "mark_ready" | "pick_up_order" | "start_brewing";

export function createCoffeeAssistantTools(
  runApp: CoffeeAppRunner,
  emitActivity: AssistantToolEmitter,
) {
  return [
    createListMenuTool(runApp, emitActivity),
    createGetItemOptionsTool(runApp, emitActivity),
    createValidateOrderTool(runApp, emitActivity),
    createQuoteOrderTool(runApp, emitActivity),
    createPlaceOrderTool(runApp, emitActivity),
    createGetOrderTool(runApp, emitActivity),
    createListOrdersTool(runApp, emitActivity),
    createOrderIdTool("start_brewing", emitActivity, runApp),
    createOrderIdTool("mark_ready", emitActivity, runApp),
    createOrderIdTool("pick_up_order", emitActivity, runApp),
    createOrderIdTool("cancel_order", emitActivity, runApp),
    createGetCartTool(runApp, emitActivity),
    createAddCartItemTool(runApp, emitActivity),
    createUpdateCartItemTool(runApp, emitActivity),
    createRemoveCartItemTool(runApp, emitActivity),
    createClearCartTool(runApp, emitActivity),
    createCheckoutCartTool(runApp, emitActivity),
  ] as const satisfies readonly AssistantToolDefinition[];
}

function createListMenuTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "list_menu",
    emitActivity,
    parameters: emptyToolParameters,
    runApp,
    tool: ListMenuTool,
  });
}

function createPlaceOrderTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "place_order",
    emitActivity,
    parameters: placeOrderToolParameters,
    runApp,
    tool: PlaceOrderTool,
  });
}

function createGetItemOptionsTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "get_item_options",
    emitActivity,
    parameters: itemOptionsToolParameters,
    runApp,
    tool: GetItemOptionsTool,
  });
}

function createValidateOrderTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "validate_order",
    emitActivity,
    parameters: quoteOrderToolParameters,
    runApp,
    tool: ValidateOrderTool,
  });
}

function createQuoteOrderTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "quote_order",
    emitActivity,
    parameters: quoteOrderToolParameters,
    runApp,
    tool: QuoteOrderTool,
  });
}

function createGetOrderTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "get_order",
    emitActivity,
    parameters: orderIdToolParameters,
    runApp,
    tool: GetOrderTool,
  });
}

function createListOrdersTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "list_orders",
    emitActivity,
    parameters: listOrdersToolParameters,
    runApp,
    tool: ListOrdersTool,
  });
}

function createGetCartTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "get_cart",
    emitActivity,
    parameters: emptyToolParameters,
    runApp,
    tool: GetCartTool,
  });
}

function createAddCartItemTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "add_cart_item",
    emitActivity,
    parameters: orderItemToolParameters,
    runApp,
    tool: AddCartItemTool,
  });
}

function createUpdateCartItemTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "update_cart_item",
    emitActivity,
    parameters: updateCartItemToolParameters,
    runApp,
    tool: UpdateCartItemTool,
  });
}

function createRemoveCartItemTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "remove_cart_item",
    emitActivity,
    parameters: cartItemIdToolParameters,
    runApp,
    tool: RemoveCartItemTool,
  });
}

function createClearCartTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "clear_cart",
    emitActivity,
    parameters: emptyToolParameters,
    runApp,
    tool: ClearCartTool,
  });
}

function createCheckoutCartTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "checkout_cart",
    emitActivity,
    parameters: checkoutCartToolParameters,
    runApp,
    tool: CheckoutCartTool,
  });
}

function createOrderIdTool(
  name: OrderStateActionName,
  emitActivity: AssistantToolEmitter,
  runApp: CoffeeAppRunner,
) {
  const tool = getOrderStateTool(name);

  return createAppTool({
    action: name,
    emitActivity,
    parameters: orderIdToolParameters,
    runApp,
    tool,
  });
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

function getOrderStateTool(name: OrderStateActionName): Tool.Any {
  return Match.value(name).pipe(
    Match.when("start_brewing", () => StartBrewingTool),
    Match.when("mark_ready", () => MarkReadyTool),
    Match.when("pick_up_order", () => PickUpOrderTool),
    Match.when("cancel_order", () => CancelOrderTool),
    Match.exhaustive,
  );
}

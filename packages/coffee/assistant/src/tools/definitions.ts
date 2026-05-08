import type { AiTextGenerationToolLegacyInput } from "@cloudflare/workers-types";
import { type CoffeeActionName, coffeeActionSpecs } from "@effect-coffee-shop/coffee-actions/specs";
import {
  executeCoffeeAction,
  type CoffeeAppRunner,
} from "@effect-coffee-shop/coffee-actions/execute";
import {
  formatToolFailure,
  formatToolPayload,
  serializeToolResult,
} from "@effect-coffee-shop/coffee-actions/format";
import {
  emptyToolParameters,
  listOrdersToolParameters,
  orderIdToolParameters,
  placeOrderToolParameters,
} from "./parameters.ts";

interface AssistantToolActivity {
  readonly detail: string;
  readonly kind: "tool-call" | "tool-result";
  readonly label: string;
}

export function getAssistantToolActivityEvent(): string {
  return "assistant_tool_activity";
}

export interface AssistantToolDefinition extends AiTextGenerationToolLegacyInput {
  readonly execute: (input: unknown) => Promise<string>;
}

type AssistantToolEmitter = (activity: AssistantToolActivity) => void;

export function createCoffeeAssistantTools(
  runApp: CoffeeAppRunner,
  emitActivity: AssistantToolEmitter,
) {
  return [
    createListMenuTool(runApp, emitActivity),
    createPlaceOrderTool(runApp, emitActivity),
    createGetOrderTool(runApp, emitActivity),
    createListOrdersTool(runApp, emitActivity),
    createOrderIdTool("start_brewing", emitActivity, runApp),
    createOrderIdTool("mark_ready", emitActivity, runApp),
    createOrderIdTool("pick_up_order", emitActivity, runApp),
    createOrderIdTool("cancel_order", emitActivity, runApp),
  ] as const satisfies readonly AssistantToolDefinition[];
}

function createListMenuTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "list_menu",
    description: coffeeActionSpecs.list_menu.description,
    emitActivity,
    name: "list_menu",
    parameters: emptyToolParameters,
    runApp,
  });
}

function createPlaceOrderTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "place_order",
    description: coffeeActionSpecs.place_order.description,
    emitActivity,
    name: "place_order",
    parameters: placeOrderToolParameters,
    runApp,
  });
}

function createGetOrderTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "get_order",
    description: coffeeActionSpecs.get_order.description,
    emitActivity,
    name: "get_order",
    parameters: orderIdToolParameters,
    runApp,
  });
}

function createListOrdersTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    action: "list_orders",
    description: coffeeActionSpecs.list_orders.description,
    emitActivity,
    name: "list_orders",
    parameters: listOrdersToolParameters,
    runApp,
  });
}

function createOrderIdTool(
  name: CoffeeActionName,
  emitActivity: AssistantToolEmitter,
  runApp: CoffeeAppRunner,
) {
  return createAppTool({
    action: name,
    description: coffeeActionSpecs[name].description,
    emitActivity,
    name,
    parameters: orderIdToolParameters,
    runApp,
  });
}

function createAppTool(input: {
  readonly action: CoffeeActionName;
  readonly description: string;
  readonly emitActivity: AssistantToolEmitter;
  readonly name: string;
  readonly parameters: NonNullable<AiTextGenerationToolLegacyInput["parameters"]>;
  readonly runApp: CoffeeAppRunner;
}): AssistantToolDefinition {
  const { action, description, emitActivity, name, parameters, runApp } = input;

  return {
    description,
    execute: async (toolInput) => {
      emitActivity({
        detail: formatToolPayload(toolInput),
        kind: "tool-call",
        label: name,
      });

      try {
        const output = await executeCoffeeAction({
          action,
          payload: toolInput,
          runApp,
        });
        const serializedOutput = serializeToolResult(output);

        emitActivity({
          detail: formatToolPayload(output),
          kind: "tool-result",
          label: name,
        });

        return serializedOutput;
      } catch (error) {
        const detail = formatToolFailure(error);

        emitActivity({
          detail,
          kind: "tool-result",
          label: name,
        });

        return detail;
      }
    },
    name,
    parameters,
  };
}

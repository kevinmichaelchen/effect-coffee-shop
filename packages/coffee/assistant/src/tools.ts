import type { AiTextGenerationToolLegacyInput } from "@cloudflare/workers-types";
import * as Effect from "effect/Effect";
import { coffeeMcpActionSpecs } from "@effect-coffee-shop/coffee-actions/actions";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import {
  decodeListOrdersInput,
  decodeOrderIdInput,
  decodePlaceOrderInput,
  emptyToolParameters,
  listOrdersToolParameters,
  orderIdToolParameters,
  placeOrderToolParameters,
} from "@effect-coffee-shop/coffee-actions/assistant-tool-data";
import {
  formatToolFailure,
  formatToolPayload,
  serializeToolResult,
} from "@effect-coffee-shop/coffee-actions/tool-format";

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

type CoffeeAppRunner = <A, E>(effect: Effect.Effect<A, E, CoffeeOrderApp>) => Promise<A>;

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
    createOrderIdTool(
      "start_brewing",
      coffeeMcpActionSpecs.start_brewing.description,
      emitActivity,
      runApp,
      (orderId) => CoffeeOrderApp.use((app) => app.startBrewing(orderId)),
    ),
    createOrderIdTool(
      "mark_ready",
      coffeeMcpActionSpecs.mark_ready.description,
      emitActivity,
      runApp,
      (orderId) => CoffeeOrderApp.use((app) => app.markReady(orderId)),
    ),
    createOrderIdTool(
      "pick_up_order",
      coffeeMcpActionSpecs.pick_up_order.description,
      emitActivity,
      runApp,
      (orderId) => CoffeeOrderApp.use((app) => app.pickUpOrder(orderId)),
    ),
    createOrderIdTool(
      "cancel_order",
      coffeeMcpActionSpecs.cancel_order.description,
      emitActivity,
      runApp,
      (orderId) => CoffeeOrderApp.use((app) => app.cancelOrder(orderId)),
    ),
  ] as const satisfies readonly AssistantToolDefinition[];
}

function createListMenuTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    description: coffeeMcpActionSpecs.list_menu.description,
    emitActivity,
    execute: async () => runApp(CoffeeOrderApp.use((app) => app.listMenu())),
    name: "list_menu",
    parameters: emptyToolParameters,
  });
}

function createPlaceOrderTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    description: coffeeMcpActionSpecs.place_order.description,
    emitActivity,
    execute: async (input) => {
      const request = await decodePlaceOrderInput(input);
      return runApp(CoffeeOrderApp.use((app) => app.placeOrder(request)));
    },
    name: "place_order",
    parameters: placeOrderToolParameters,
  });
}

function createGetOrderTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    description: coffeeMcpActionSpecs.get_order.description,
    emitActivity,
    execute: async (input) => {
      const { orderId } = await decodeOrderIdInput(input);
      return runApp(CoffeeOrderApp.use((app) => app.getOrder(orderId)));
    },
    name: "get_order",
    parameters: orderIdToolParameters,
  });
}

function createListOrdersTool(runApp: CoffeeAppRunner, emitActivity: AssistantToolEmitter) {
  return createAppTool({
    description: coffeeMcpActionSpecs.list_orders.description,
    emitActivity,
    execute: async (input) => {
      const request = await decodeListOrdersInput(input);
      return runApp(CoffeeOrderApp.use((app) => app.listOrders(request)));
    },
    name: "list_orders",
    parameters: listOrdersToolParameters,
  });
}

function createOrderIdTool(
  name: AssistantToolDefinition["name"],
  description: string,
  emitActivity: AssistantToolEmitter,
  runApp: CoffeeAppRunner,
  execute: (orderId: string) => Effect.Effect<unknown, unknown, CoffeeOrderApp>,
) {
  return createAppTool({
    description,
    emitActivity,
    execute: async (input) => {
      const { orderId } = await decodeOrderIdInput(input);
      return runApp(execute(orderId));
    },
    name,
    parameters: orderIdToolParameters,
  });
}

function createAppTool(input: {
  readonly description: string;
  readonly emitActivity: AssistantToolEmitter;
  readonly execute: (input: unknown) => Promise<unknown>;
  readonly name: string;
  readonly parameters: NonNullable<AiTextGenerationToolLegacyInput["parameters"]>;
}): AssistantToolDefinition {
  const { description, emitActivity, execute, name, parameters } = input;

  return {
    description,
    execute: async (toolInput) => {
      emitActivity({
        detail: formatToolPayload(toolInput),
        kind: "tool-call",
        label: name,
      });

      try {
        const output = await execute(toolInput);
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

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as Tool from "effect/unstable/ai/Tool";
import * as Toolkit from "effect/unstable/ai/Toolkit";
import { coffeeMcpActionSpecs, CoffeeMcpActions } from "./actions.ts";
import {
  CodeModeFailureSchema,
  CodeModeSuccessSchema,
  CoffeeCodeModeDescription,
} from "./code-mode-description.ts";
import { executeCodeMode, makeActionCall, toCodeModeFailure } from "#runtime/bun/mcpCodeMode";

const CodeTool = Tool.make("code", {
  description: CoffeeCodeModeDescription,
  parameters: Schema.Struct({
    code: Schema.String,
  }),
  success: CodeModeSuccessSchema,
  failure: CodeModeFailureSchema,
});

const CoffeeCodeModeToolkit = Toolkit.make(CodeTool);

const makeCodeModeApi = (actions: CoffeeMcpActions["Service"]) => ({
  list_menu: makeActionCall(
    coffeeMcpActionSpecs.list_menu.parameters,
    coffeeMcpActionSpecs.list_menu.success,
    () => actions.list_menu(),
    { allowEmptyObject: true },
  ),
  place_order: makeActionCall(
    coffeeMcpActionSpecs.place_order.parameters,
    coffeeMcpActionSpecs.place_order.success,
    actions.place_order,
  ),
  get_order: makeActionCall(
    coffeeMcpActionSpecs.get_order.parameters,
    coffeeMcpActionSpecs.get_order.success,
    actions.get_order,
  ),
  list_orders: makeActionCall(
    coffeeMcpActionSpecs.list_orders.parameters,
    coffeeMcpActionSpecs.list_orders.success,
    actions.list_orders,
  ),
  start_brewing: makeActionCall(
    coffeeMcpActionSpecs.start_brewing.parameters,
    coffeeMcpActionSpecs.start_brewing.success,
    actions.start_brewing,
  ),
  mark_ready: makeActionCall(
    coffeeMcpActionSpecs.mark_ready.parameters,
    coffeeMcpActionSpecs.mark_ready.success,
    actions.mark_ready,
  ),
  pick_up_order: makeActionCall(
    coffeeMcpActionSpecs.pick_up_order.parameters,
    coffeeMcpActionSpecs.pick_up_order.success,
    actions.pick_up_order,
  ),
  cancel_order: makeActionCall(
    coffeeMcpActionSpecs.cancel_order.parameters,
    coffeeMcpActionSpecs.cancel_order.success,
    actions.cancel_order,
  ),
});

export const CoffeeCodeModeToolsLive = McpServer.toolkit(CoffeeCodeModeToolkit).pipe(
  Layer.provideMerge(
    CoffeeCodeModeToolkit.toLayer(
      CoffeeMcpActions.use((actions) =>
        Effect.succeed({
          code: ({ code }) =>
            Effect.tryPromise({
              try: async () => executeCodeMode(code, makeCodeModeApi(actions)),
              catch: toCodeModeFailure,
            }),
        }),
      ),
    ),
  ),
  Layer.provide(CoffeeMcpActions.layer),
);

import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import { rules } from "./oxlint-plugin-house.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester();

const app = "/repo/packages/coffee/application/src/placeOrder.ts";
const domain = "/repo/packages/coffee/domain/src/order.ts";
const mcp = "/repo/packages/coffee/presentation/mcp/src/tools.ts";

// Effect style rules only run in files that import from `effect`.
const effect = (code: string): string => `import { Effect } from "effect";\n${code}`;

tester.run("no-in-operator", rules["no-in-operator"], {
  valid: [{ code: "for (const key in record) use(key);", filename: app }],
  invalid: [
    { code: 'const has = "id" in value;', filename: app, errors: [{ messageId: "inOperator" }] },
  ],
});

tester.run("no-instanceof", rules["no-instanceof"], {
  valid: [{ code: 'const isError = value._tag === "Failure";', filename: app }],
  invalid: [
    {
      code: "const isError = value instanceof Error;",
      filename: app,
      errors: [{ messageId: "noInstanceof" }],
    },
  ],
});

tester.run("no-classic-for-loop", rules["no-classic-for-loop"], {
  valid: [
    { code: "for (const item of items) use(item);", filename: app },
    {
      code: "for (let i = 0; i < bins; i += 1) use(i);",
      filename: "/repo/apps/ui/src/audio/log-mel.kernel.ts",
    },
  ],
  invalid: [
    {
      code: "for (let i = 0; i < items.length; i += 1) use(items[i]);",
      filename: app,
      errors: [{ messageId: "noClassicForLoop" }],
    },
  ],
});

tester.run("mcp-tool-name-snake-case", rules["mcp-tool-name-snake-case"], {
  valid: [
    { code: 'Tool.make("place_order", {});', filename: mcp },
    { code: "Tool.make(`list_orders`, {});", filename: mcp },
    { code: 'Other.make("placeOrder", {});', filename: mcp },
  ],
  invalid: [
    {
      code: 'Tool.make("placeOrder", {});',
      filename: mcp,
      errors: [{ messageId: "toolNameSnakeCase" }],
    },
    { code: "Tool.make(toolId, {});", filename: mcp, errors: [{ messageId: "toolNameLiteral" }] },
    {
      code: "Tool.make(`place_${kind}`, {});",
      filename: mcp,
      errors: [{ messageId: "toolNameLiteral" }],
    },
  ],
});

tester.run("no-boundary-contracts-in-domain", rules["no-boundary-contracts-in-domain"], {
  valid: [
    { code: "export interface Order { readonly id: string }", filename: domain },
    { code: "export const placeOrderRequest = 1;", filename: domain },
    { code: "export interface PlaceOrderRequest { readonly id: string }", filename: app },
  ],
  invalid: [
    {
      code: "export interface PlaceOrderRequest { readonly id: string }",
      filename: domain,
      errors: [{ messageId: "moveBoundaryContractOutOfDomain" }],
    },
    {
      code: "export const OrderResponseSchema = make();",
      filename: domain,
      errors: [{ messageId: "moveBoundaryContractOutOfDomain" }],
    },
    {
      code: "export type OrderQuery = { readonly id: string };",
      filename: domain,
      errors: [{ messageId: "moveBoundaryContractOutOfDomain" }],
    },
    {
      code: "export class OrderPayload {}",
      filename: domain,
      errors: [{ messageId: "moveBoundaryContractOutOfDomain" }],
    },
  ],
});

tester.run("no-new-date-in-core", rules["no-new-date-in-core"], {
  valid: [
    { code: "const now = DateTime.now;", filename: app },
    { code: "const now = new Date();", filename: mcp },
    { code: "const now = new Date();", filename: "/repo/packages/coffee/domain/src/order.test.ts" },
  ],
  invalid: [
    { code: "const now = new Date();", filename: app, errors: [{ messageId: "noNewDateInCore" }] },
    {
      code: "const at = new Date(0);",
      filename: domain,
      errors: [{ messageId: "noNewDateInCore" }],
    },
  ],
});

tester.run("no-effect-call-in-effect-arg", rules["no-effect-call-in-effect-arg"], {
  valid: [
    { code: effect("const out = Effect.flatMap(task, (v) => Effect.succeed(v));"), filename: app },
    // Not an Effect file.
    { code: "const out = Effect.map(Effect.succeed(1), inc);", filename: app },
    {
      code: effect("const out = Effect.map(Effect.succeed(1), inc);"),
      filename: "/repo/packages/coffee/application/src/placeOrder.test.ts",
    },
    {
      code: effect("const out = Effect.map(Effect.succeed(1), inc);"),
      filename: "/repo/packages/coffee/application/test/contract.ts",
    },
  ],
  invalid: [
    {
      code: effect("const out = Effect.map(Effect.flatMap(task, next), inc);"),
      filename: app,
      errors: [{ messageId: "noEffectCallInEffectArg" }],
    },
  ],
});

tester.run("no-inline-runtime-provide", rules["no-inline-runtime-provide"], {
  valid: [
    { code: effect("export const main = program.pipe(Effect.provide(Live));"), filename: app },
  ],
  invalid: [
    {
      code: effect(
        "const run = Effect.gen(function* () { yield* load.pipe(Effect.provide(Live)); });",
      ),
      filename: app,
      errors: [{ messageId: "noInlineRuntimeProvide" }],
    },
  ],
});

tester.run("no-model-overlay-cast", rules["no-model-overlay-cast"], {
  valid: [
    { code: effect("const exact = source as const;"), filename: app },
    { code: effect("let loose = source as User;"), filename: app },
  ],
  invalid: [
    {
      code: effect("const user = source as User;"),
      filename: app,
      errors: [{ messageId: "noModelOverlayCast" }],
    },
  ],
});

tester.run("no-nested-effect-gen", rules["no-nested-effect-gen"], {
  valid: [
    { code: effect("const run = Effect.gen(function* () { yield* load; });"), filename: app },
  ],
  invalid: [
    {
      code: effect(
        "const run = Effect.gen(function* () { yield* Effect.gen(function* () { yield* load; }); });",
      ),
      filename: app,
      errors: [{ messageId: "noNestedEffectGen" }],
    },
  ],
});

tester.run("no-string-sentinel-const", rules["no-string-sentinel-const"], {
  valid: [
    { code: effect('const label = "ready";'), filename: app },
    { code: effect("const status = compute();"), filename: app },
    { code: effect('let orderStatus = "ready";'), filename: app },
  ],
  invalid: [
    {
      code: effect('const orderStatus = "ready";'),
      filename: app,
      errors: [{ messageId: "noStringSentinelConst" }],
    },
  ],
});

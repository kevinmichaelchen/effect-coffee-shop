import { assert, describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as R from "effect/Record";
import * as Order from "effect/Order";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpTest from "effect/ai/McpTest";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import {
  type AppActor,
  anonymousActor,
  systemActor,
} from "@effect-coffee-shop/coffee-application/CurrentActor";
import { CustomerId } from "@effect-coffee-shop/coffee-domain/Customer/Customer.id";
import { CoffeeActionToolkit } from "./action-toolkit.ts";
import { McpActor } from "./actor.ts";
import { CoffeeMcpFeaturesLive } from "./server.ts";

const staffTools = ["start_brewing", "mark_ready", "pick_up_order", "cancel_order"];
const allTools = Arr.sort(R.keys(CoffeeActionToolkit.tools), Order.String);
const customerTools = allTools.filter((name) => !staffTools.includes(name));
const customer: AppActor = {
  kind: "customer",
  userId: CustomerId.make("customer"),
  displayName: "Customer",
};
const staff: AppActor = {
  kind: "staff",
  userId: CustomerId.make("staff"),
  displayName: "Barista",
};

const makeClient = (current: Effect.Effect<AppActor>) =>
  McpTest.makeClient(
    CoffeeMcpFeaturesLive.pipe(
      Layer.provide(Layer.mock(CoffeeOrderApp, {})),
      Layer.provide(Layer.succeed(McpActor, { current })),
    ),
    { protocols: [McpProtocol.v2026_07_28] },
  );

describe("MCP tool visibility", () => {
  it.effect("serves the ordering skill alongside existing resources", () =>
    Effect.gen(function* () {
      const client = yield* makeClient(Effect.succeed(customer));
      const uri = "skill://coffee/order-coffee/SKILL.md";
      const resources = yield* client.listResources();
      expect(resources.resources.map((resource) => resource.uri)).toContain(uri);
      const result = yield* client.readResource({ uri });
      expect(result.contents).toEqual([
        expect.objectContaining({
          uri,
          text: expect.stringContaining("name: order-coffee"),
        }),
      ]);
    }),
  );

  it.effect.each([
    { name: "customer", actor: customer, expected: customerTools },
    { name: "staff", actor: staff, expected: allTools },
    { name: "anonymous", actor: anonymousActor, expected: customerTools },
    { name: "system", actor: systemActor, expected: allTools },
  ])("lists exactly the tools visible to $name", ({ actor, expected }) =>
    Effect.gen(function* () {
      const client = yield* makeClient(Effect.succeed(actor));
      const result = yield* client.listTools();
      assert.deepStrictEqual(
        Arr.sort(
          result.tools.map((tool) => tool.name),
          Order.String,
        ),
        expected,
      );
      assert.include(
        result.tools.map((tool) => tool.name),
        "list_orders",
      );
    }),
  );

  it.effect("rejects calls to hidden tools before invoking the application", () =>
    Effect.gen(function* () {
      const client = yield* makeClient(Effect.succeed(customer));
      yield* Effect.forEach(
        staffTools,
        (name) =>
          Effect.gen(function* () {
            const error = yield* client
              .callTool({ name, arguments: { orderId: "order-1" } })
              .pipe(Effect.flip);
            expect(error.message).toBe(`Tool '${name}' not found`);
          }),
        { concurrency: 1 },
      );
    }),
  );

  it.effect("resolves visibility again when the actor changes on the same client", () =>
    Effect.gen(function* () {
      const actor = yield* Ref.make<AppActor>(staff);
      const client = yield* makeClient(Ref.get(actor));
      const before = yield* client.listTools();
      expect(
        Arr.sort(
          before.tools.map((tool) => tool.name),
          Order.String,
        ),
      ).toEqual(allTools);

      yield* Ref.set(actor, customer);
      const after = yield* client.listTools();
      expect(
        Arr.sort(
          after.tools.map((tool) => tool.name),
          Order.String,
        ),
      ).toEqual(customerTools);
      const error = yield* client
        .callTool({ name: "start_brewing", arguments: { orderId: "order-1" } })
        .pipe(Effect.flip);
      expect(error.message).toBe("Tool 'start_brewing' not found");
    }),
  );
});

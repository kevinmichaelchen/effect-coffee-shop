import { assert, describe, expect, it } from "@effect/vitest";
import * as Domain from "@alchemy.run/domain";
import * as DomainAi from "@alchemy.run/domain/Ai";
import * as Arr from "effect/Array";
import * as R from "effect/Record";
import * as Order from "effect/Order";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as References from "effect/References";
import * as Schema from "effect/Schema";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpTest from "effect/ai/McpTest";
import { actorHeader } from "@effect-coffee-shop/coffee-application/ActorHeader";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import {
  type AppActor,
  AuthenticationRequiredError,
  anonymousActor,
  systemActor,
} from "@effect-coffee-shop/coffee-application/CurrentActor";
import { Actor } from "@effect-coffee-shop/coffee-domain/Actor";
import { CoffeeShop, CoffeeShopHandlers } from "@effect-coffee-shop/coffee-domain/CoffeeShop.model";
import { CurrentActor } from "@effect-coffee-shop/coffee-domain/CurrentActor.context";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { CustomerId } from "@effect-coffee-shop/coffee-domain/Customer/Customer.id";
import { Session, Unauthorized } from "@effect-coffee-shop/coffee-domain/Session.middleware";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import { CoffeeActionToolkit } from "./action-toolkit.ts";
import { McpActor } from "./actor.ts";
import { CoffeeMcpFeaturesLive } from "./server.ts";

const sorted = (names: ReadonlyArray<string>) => Arr.sort(names, Order.String);
const toolNames = (api: DomainAi.Toolable) => R.keys(DomainAi.toToolkit(api).toolkit.tools);

const staffTools = sorted(toolNames(StaffApi));
const customerTools = sorted([...R.keys(CoffeeActionToolkit.tools), ...toolNames(CustomerApi)]);
const allTools = sorted([...customerTools, ...staffTools]);

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

/** The Worker's `Session` middleware, as it reads the actor header the MCP tools send. */
const decodeActor = Schema.decodeUnknownOption(Schema.fromJsonString(Actor));
const TestSession = Layer.succeed(Session, (effect, { headers }) =>
  Option.match(Option.flatMap(Option.fromNullishOr(headers[actorHeader]), decodeActor), {
    onNone: () => Effect.fail(new Unauthorized()),
    onSome: (actor) => Effect.provideService(effect, CurrentActor, actor),
  }),
);

const World = Layer.mergeAll(TestSession, CoffeeOrderApp.layer).pipe(
  Layer.provideMerge(CoffeeShop.layer(CoffeeShopHandlers)),
  Layer.provide(Domain.InMemory),
  Layer.provide(Layer.succeed(References.MinimumLogLevel, "Warn")),
);

const makeClient = (current: McpActor["Service"]["current"]) =>
  McpTest.makeClient(
    CoffeeMcpFeaturesLive.pipe(
      Layer.provide(Layer.succeed(McpActor, { current })),
      Layer.provide(World),
    ),
    { protocols: [McpProtocol.v2026_07_28] },
  );

/** A tool's typed failure, which MCP returns as the JSON text of an error result. */
const failureOf = (result: { readonly content: ReadonlyArray<unknown> }) =>
  Schema.decodeUnknownSync(
    Schema.Tuple([Schema.Struct({ text: Schema.fromJsonString(Schema.Json) })]),
  )(result.content)[0].text;

const listToolNames = (client: Effect.Success<ReturnType<typeof makeClient>>) =>
  Effect.map(client.listTools(), (result) => sorted(result.tools.map((tool) => tool.name)));

describe("MCP tool visibility", () => {
  it("generates the domain tools beside the hand-written ones", () => {
    expect(allTools).toEqual(
      expect.arrayContaining([
        "get_ordering_context",
        "list_menu",
        "CustomerApi_PlaceOrder_send",
        "CustomerApi_Cart_get",
        "StaffApi_StartBrewing_send",
        "StaffApi_OrderQueue_get",
      ]),
    );
    expect(allTools).not.toContain("place_order");
    expect(staffTools.every((name) => name.startsWith("StaffApi_"))).toBe(true);
  });

  it.effect("serves the ordering skill alongside existing resources", () =>
    Effect.gen(function* () {
      const client = yield* makeClient(Effect.succeed(customer));
      const uri = "skill://coffee/order-coffee/SKILL.md";
      const resources = yield* client.listResources();
      expect(resources.resources.map((resource) => resource.uri)).toContain(uri);
      const result = yield* client.readResource({ uri });
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toHaveProperty("uri", uri);
      expect(result.contents[0]).toHaveProperty(
        "text",
        expect.stringContaining("name: order-coffee"),
      );
    }),
  );

  it.effect("names only tools that exist in the ordering skill", () =>
    Effect.gen(function* () {
      const client = yield* makeClient(Effect.succeed(staff));
      const served = yield* listToolNames(client);
      const result = yield* client.readResource({ uri: "skill://coffee/order-coffee/SKILL.md" });
      const text = Arr.flatMap(result.contents, (content) =>
        "text" in content ? [content.text] : [],
      ).join("\n");
      const named = Arr.dedupe(
        Arr.flatMap([...text.matchAll(/`([A-Za-z_]+)`/g)], ([, name]) => Arr.fromNullishOr(name)),
      );
      expect(named.length).toBeGreaterThan(5);
      expect(named.filter((name) => !served.includes(name))).toEqual([]);
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
      assert.deepStrictEqual(yield* listToolNames(client), expected);
    }),
  );

  it.effect("rejects calls to hidden tools before invoking the Api", () =>
    Effect.gen(function* () {
      const client = yield* makeClient(Effect.succeed(customer));
      yield* Effect.forEach(
        staffTools,
        (name) =>
          Effect.gen(function* () {
            const error = yield* client
              .callTool({ name, arguments: { target: "order-1", input: {} } })
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
      expect(yield* listToolNames(client)).toEqual(allTools);

      yield* Ref.set(actor, customer);
      expect(yield* listToolNames(client)).toEqual(customerTools);
      const error = yield* client
        .callTool({ name: "StaffApi_StartBrewing_send", arguments: { target: "x", input: {} } })
        .pipe(Effect.flip);
      expect(error.message).toBe("Tool 'StaffApi_StartBrewing_send' not found");
    }),
  );
});

describe("MCP tools generated from the domain Apis", () => {
  it.live("act for the OAuth-resolved actor: the ids and cart of the signed-in customer", () =>
    Effect.gen(function* () {
      const client = yield* makeClient(Effect.succeed(customer));
      const context = yield* client.callTool({ name: "get_ordering_context", arguments: {} });
      expect(context.isError).not.toBe(true);
      expect(context.structuredContent).toMatchObject({
        isSignedIn: true,
        isStaff: false,
        customerId: "customer",
        shopId: "main",
      });
      const { newIds } = yield* Schema.decodeUnknownEffect(
        Schema.Struct({ newIds: Schema.Struct({ cartItemId: Schema.String }) }),
      )(context.structuredContent);

      const added = yield* client.callTool({
        name: "CustomerApi_AddCartItem_send",
        arguments: {
          target: "customer",
          input: { cartItemId: newIds.cartItemId, item: { drinkId: "latte", size: "medium" } },
        },
      });
      expect(added.isError).not.toBe(true);

      const cart = yield* client.callTool({
        name: "CustomerApi_Cart_get",
        arguments: { key: "customer" },
      });
      expect(cart.structuredContent).toMatchObject({
        lines: [{ cartItemId: newIds.cartItemId, item: { drinkId: "latte" } }],
      });

      const othersCart = yield* client.callTool({
        name: "CustomerApi_Cart_get",
        arguments: { key: "someone-else" },
      });
      expect(othersCart.isError).toBe(true);
      expect(failureOf(othersCart)).toEqual({ _tag: "NotYourCart" });
    }),
  );

  it.effect.each([
    { name: "an anonymous actor", current: Effect.succeed(anonymousActor) },
    {
      name: "an actor that cannot be resolved",
      current: Effect.fail(new AuthenticationRequiredError({ message: "No token" })),
    },
  ])("return Unauthorized for $name", ({ current }) =>
    Effect.gen(function* () {
      const client = yield* makeClient(current);
      const result = yield* client.callTool({
        name: "CustomerApi_Cart_get",
        arguments: { key: "customer" },
      });
      assert.isTrue(result.isError);
      assert.deepStrictEqual(failureOf(result), { _tag: "Unauthorized" });
    }),
  );
});

import type { D1Database } from "@cloudflare/workers-types";
import type { AgentSession } from "@better-auth/agent-auth";
import * as Schema from "effect/Schema";
import { Miniflare } from "miniflare";
import { describe, expect, it } from "vitest";
import {
  CoffeeOrderViewSchema,
  CoffeeOrdersViewSchema,
  type CoffeeOrderView,
  type CoffeeOrdersView,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import {
  createCoffeeAgentAppRunner,
  createCoffeeAgentAuthOptions,
  executeCoffeeAgentCapability,
} from "@effect-coffee-shop/coffee-auth/agent/options";
import { makeCloudflareCoffeeAppLive } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";

async function withTestDatabase<A>(effect: (db: D1Database) => Promise<A>): Promise<A> {
  const miniflare = new Miniflare({
    d1Databases: {
      DB: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    },
    modules: true,
    script: "",
  });
  const db: D1Database = await miniflare.getD1Database("DB");

  try {
    return await effect(db);
  } finally {
    await miniflare.dispose();
  }
}

function createAgentSession(input: {
  readonly email?: string;
  readonly name: string;
  readonly userId: string;
}): AgentSession {
  return {
    agent: {
      activatedAt: new Date(),
      capabilityGrants: [],
      createdAt: new Date(),
      hostId: "host-coffee",
      id: "agent-coffee",
      metadata: null,
      mode: "delegated",
      name: "Coffee Agent",
    },
    host: null,
    type: "delegated",
    user: {
      email: input.email ?? `${input.userId}@example.com`,
      id: input.userId,
      name: input.name,
    },
  };
}

async function placeLatteOrder(db: D1Database, session: AgentSession) {
  const runApp = createCoffeeAgentAppRunner({
    appLayer: makeCloudflareCoffeeAppLive(db),
    session,
  });
  const orderInput = {
    items: [{ drinkId: "latte", size: "medium" }],
  };
  await executeCoffeeAgentCapability({
    arguments: orderInput,
    capability: "prepare_order_confirmation",
    runApp,
  });
  const result = await executeCoffeeAgentCapability({
    arguments: orderInput,
    capability: "place_order",
    runApp,
  });

  return Schema.decodeUnknownPromise(CoffeeOrderViewSchema)(result);
}

async function listOrders(db: D1Database, session: AgentSession): Promise<CoffeeOrdersView> {
  const runApp = createCoffeeAgentAppRunner({
    appLayer: makeCloudflareCoffeeAppLive(db),
    session,
  });
  const result = await executeCoffeeAgentCapability({
    arguments: {},
    capability: "list_orders",
    runApp,
  });

  return Schema.decodeUnknownPromise(CoffeeOrdersViewSchema)(result);
}

async function getOrder(
  db: D1Database,
  orderId: string,
  session: AgentSession,
): Promise<CoffeeOrderView> {
  const runApp = createCoffeeAgentAppRunner({
    appLayer: makeCloudflareCoffeeAppLive(db),
    session,
  });
  const result = await executeCoffeeAgentCapability({
    arguments: { orderId },
    capability: "get_order",
    runApp,
  });

  return Schema.decodeUnknownPromise(CoffeeOrderViewSchema)(result);
}

describe("coffee agent auth", () => {
  it("publishes the delegated customer capabilities", async () => {
    await withTestDatabase(async (db) => {
      const options = createCoffeeAgentAuthOptions({
        appLayer: makeCloudflareCoffeeAppLive(db),
      });

      expect(options.capabilities?.map((capability) => capability.name)).toEqual([
        "list_menu",
        "get_item_options",
        "validate_order",
        "quote_order",
        "prepare_order_confirmation",
        "prepare_cart_confirmation",
        "place_order",
        "get_order",
        "list_orders",
        "get_cart",
        "add_cart_item",
        "update_cart_item",
        "remove_cart_item",
        "clear_cart",
        "checkout_cart",
      ]);
    });
  });

  it("executes customer-scoped order capabilities with the signed-in agent session", async () => {
    await withTestDatabase(async (db) => {
      const alice = createAgentSession({
        name: "Alice Example",
        userId: "user-alice",
      });
      const bob = createAgentSession({
        name: "Bob Example",
        userId: "user-bob",
      });
      const order = await placeLatteOrder(db, alice);

      expect(order).toMatchObject({
        customerName: "Alice Example",
        ownerUserId: "user-alice",
      });

      const aliceOrders = await listOrders(db, alice);
      const bobOrders = await listOrders(db, bob);
      expect(aliceOrders).toHaveLength(1);
      expect(bobOrders).toEqual([]);
      await expect(getOrder(db, "order-0001", bob)).rejects.toThrowError(
        "Order order-0001 was not found.",
      );
    });
  });

  it("rejects malformed capability arguments before touching the app layer", async () => {
    await withTestDatabase(async (db) => {
      const session = createAgentSession({
        name: "Alice Example",
        userId: "user-alice",
      });

      await expect(
        executeCoffeeAgentCapability({
          arguments: {},
          capability: "place_order",
          runApp: createCoffeeAgentAppRunner({
            appLayer: makeCloudflareCoffeeAppLive(db),
            session,
          }),
        }),
      ).rejects.toThrowError("Invalid place_order arguments.");
    });
  });
});

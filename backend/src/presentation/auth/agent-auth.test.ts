import type { D1Database } from "@cloudflare/workers-types";
import type { AgentSession } from "@better-auth/agent-auth";
import * as Schema from "effect/Schema";
import { Miniflare } from "miniflare";
import { describe, expect, it } from "vitest";
import {
  CoffeeOrderSchema,
  CoffeeOrdersSchema,
  type CoffeeOrder,
  type CoffeeOrders,
} from "#domain/order";
import {
  createCoffeeAgentAuthOptions,
  executeCoffeeAgentCapability,
} from "#presentation/auth/agent-auth";

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
  const result = await executeCoffeeAgentCapability({
    arguments: {
      drinkId: "latte",
      size: "medium",
    },
    capability: "place_order",
    db,
    email: undefined,
    session,
  });

  return Schema.decodeUnknownPromise(CoffeeOrderSchema)(result);
}

async function listOrders(db: D1Database, session: AgentSession): Promise<CoffeeOrders> {
  const result = await executeCoffeeAgentCapability({
    arguments: {},
    capability: "list_orders",
    db,
    email: undefined,
    session,
  });

  return Schema.decodeUnknownPromise(CoffeeOrdersSchema)(result);
}

async function getOrder(
  db: D1Database,
  orderId: string,
  session: AgentSession,
): Promise<CoffeeOrder> {
  const result = await executeCoffeeAgentCapability({
    arguments: { orderId },
    capability: "get_order",
    db,
    email: undefined,
    session,
  });

  return Schema.decodeUnknownPromise(CoffeeOrderSchema)(result);
}

describe("coffee agent auth", () => {
  it("publishes the delegated customer capabilities", async () => {
    await withTestDatabase(async (db) => {
      const options = createCoffeeAgentAuthOptions({ db, email: undefined });

      expect(options.capabilities?.map((capability) => capability.name)).toEqual([
        "list_menu",
        "place_order",
        "get_order",
        "list_orders",
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
          db,
          email: undefined,
          session,
        }),
      ).rejects.toThrowError("Invalid place_order arguments.");
    });
  });
});

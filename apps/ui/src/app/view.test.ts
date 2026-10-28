import { Option } from "effect";
import { Command, click, expect, given, label, role, scene, text, type } from "foldkit/scene";
import { describe, test, vi } from "vitest";

vi.mock("#features/coffee-shop/api/coffee.ts", async () => {
  const { Effect } = await import("effect");
  return {
    createOrder: () => Effect.never,
    fetchMenu: Effect.never,
    updateOrderStatus: () => Effect.never,
  };
});
vi.mock("#features/auth/auth-client.ts", () => ({
  authClient: {
    register: async () => ({ ok: true, message: "" }),
    signIn: async () => ({ ok: true, message: "" }),
    signOut: async () => ({ ok: true, message: "" }),
  },
}));

const { init } = await import("#app/main.ts");
const { RunPasskeyAuth } = await import("#app/command.ts");
const { Message } = await import("#app/message.ts");
const { update } = await import("#app/update.ts");
const { view } = await import("#app/view/root.ts");

const url = (pathname: string) => ({
  protocol: "https:",
  host: "coffee.test",
  port: Option.none(),
  pathname,
  search: Option.none(),
  hash: Option.none(),
});

const boot = (pathname: string) => init({ theme: "light" }, url(pathname)).model;

const menu = [
  {
    id: "latte",
    name: "Latte",
    kind: "espresso",
    basePriceCents: 450,
    availableMilks: ["whole", "oat"],
    availableTemperatures: ["hot", "iced"],
    maxShots: 3,
  },
  {
    id: "earl-grey",
    name: "Earl Grey",
    kind: "tea",
    basePriceCents: 300,
    availableMilks: ["none"],
    availableTemperatures: ["hot"],
    maxShots: 0,
  },
] as const;

const signedIn = {
  ...boot("/shop"),
  menu,
  viewer: { kind: "customer", displayName: "Ada", userId: "user-1" },
} as const;

describe("customer workspace", () => {
  test("anonymous visitors see the passkey gate and no composer", () => {
    scene(
      { update, view },
      given({ ...boot("/shop"), menu }),
      expect(role("heading", { name: "Sign in before placing an order" })).toExist(),
      expect(role("button", { name: "Create account with passkey" })).toExist(),
      expect(role("heading", { name: "Build an order" })).toBeAbsent(),
    );
  });

  test("a missing name blocks account creation with guidance", () => {
    scene(
      { update, view },
      given(boot("/shop")),
      click(role("button", { name: "Create account with passkey" })),
      expect(text("Enter the name you want printed on your orders.")).toExist(),
      Command.expectNone(),
    );
  });

  test("typing a name and creating an account starts the passkey ceremony", () => {
    scene(
      { update, view },
      given(boot("/shop")),
      type(label("Name on your order"), "Ada"),
      click(role("button", { name: "Create account with passkey" })),
      Command.expectExact(RunPasskeyAuth),
      Command.resolve(RunPasskeyAuth, Message.FailedAuth({ message: "Cancelled" })),
      expect(text("Cancelled")).toExist(),
    );
  });

  test("signed-in customers can build an order and see the price", () => {
    scene(
      { update, view },
      given(signedIn),
      expect(role("heading", { name: "Build an order" })).toExist(),
      expect(role("heading", { name: "$5.18" })).toExist(),
      click(role("button", { name: "Earl Grey" })),
      expect(label("Shots")).toBeDisabled(),
      expect(text("Tea stays at zero shots.")).toExist(),
    );
  });

  test("the notes field keeps what the customer typed", () => {
    scene(
      { update, view },
      given(signedIn),
      type(label("Notes"), "No lid, please."),
      expect(label("Notes")).toHaveValue("No lid, please."),
    );
  });
});

describe("session card", () => {
  test("offers a Copy ID button next to the user id", () => {
    scene(
      { update, view },
      given(signedIn),
      expect(text("user-1")).toExist(),
      expect(role("button", { name: "Copy ID" })).toExist(),
    );
  });
});

describe("staff workspace", () => {
  test("a customer account is told it is not on the allowlist", () => {
    scene(
      { update, view },
      given({ ...boot("/staff"), viewer: signedIn.viewer }),
      expect(text("Staff access required")).toExist(),
      expect(role("heading", { name: "Barista queue" })).toBeAbsent(),
    );
  });

  test("staff see the queue", () => {
    scene(
      { update, view },
      given({ ...boot("/staff"), viewer: { kind: "staff", displayName: "Sam", userId: "user-2" } }),
      expect(role("heading", { name: "Barista queue" })).toExist(),
      expect(text("No active tickets")).toExist(),
    );
  });
});

describe("not found", () => {
  test("unknown paths link back to both workspaces", () => {
    scene(
      { update, view },
      given(boot("/nope")),
      expect(role("heading", { name: "Page not found" })).toExist(),
      expect(role("link", { name: "Open staff workspace" })).toExist(),
    );
  });
});

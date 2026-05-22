import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { describe, expect, it } from "vitest";
import { anonymousActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { makeCloudflareCoffeeAppLive } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";
import {
  createCloudflareAuth,
  resolveCloudflareActor,
} from "@effect-coffee-shop/coffee-auth/better-auth/cloudflare";
import {
  createProvisionalUser,
  createRegisteredUser,
  getDisplayName,
} from "@effect-coffee-shop/coffee-auth/better-auth/users";

async function withTestDatabase<A>(effect: (db: D1Database) => Promise<A>): Promise<A> {
  const miniflare = new Miniflare({
    d1Databases: {
      DB: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    },
    modules: true,
    script: "",
  });
  const db: D1Database = await miniflare.getD1Database("DB");

  return effect(db).finally(() => miniflare.dispose());
}

describe("passkey registration helpers", () => {
  it("creates provisional users from the registration context display name", () => {
    const provisional = createProvisionalUser(getDisplayName('{"displayName":"Alice Example"}'));

    expect(provisional.displayName).toBe("Alice Example");
    expect(provisional.id.startsWith("passkey-signup-")).toBe(true);
    expect(provisional.name).toBe("Alice Example");
  });

  it("persists passkey-first users from the verify-registration context", () => {
    const created = createRegisteredUser({
      context: '{"displayName":"Alice Example"}',
      userId: "passkey-signup-user-123",
    });

    expect(created).toEqual({
      email: "passkey-signup-user-123@users.coffee.invalid",
      id: "passkey-signup-user-123",
      name: "Alice Example",
    });
  });

  it("rejects blank display names", () => {
    expect(() => getDisplayName('{"displayName":"   "}')).toThrowError(
      "displayName must not be blank",
    );
  });
});

describe("cloudflare better-auth wiring", () => {
  it("requires a nonblank secret when constructing auth", async () => {
    await withTestDatabase(async (db) => {
      expect(() =>
        createCloudflareAuth({
          appLayer: makeCloudflareCoffeeAppLive(db),
          db,
          request: new Request("http://example.com/api/auth/session"),
          secret: "   ",
        }),
      ).toThrow();
    });
  });

  it("resolves anonymous actors when auth is not configured", async () => {
    await withTestDatabase(async (db) => {
      const actor = await resolveCloudflareActor({
        appLayer: makeCloudflareCoffeeAppLive(db),
        db,
        request: new Request("http://example.com/api/me"),
        secret: undefined,
        staffUserIds: new Set(["staff-user"]),
      });

      expect(actor).toEqual(anonymousActor);
    });
  });
});

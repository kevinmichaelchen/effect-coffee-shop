import { describe, expect, it } from "vitest";
import {
  createProvisionalUser,
  createRegisteredUser,
  getDisplayName,
} from "@effect-coffee-shop/coffee-auth/better-auth";

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

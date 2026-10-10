/**
 * Tests AWS Lambda runtime configuration decoding.
 *
 * @module
 */
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { describe, expect, it } from "vitest";
import { readAwsRuntime, type AwsLambdaEnv } from "./env.ts";

describe("aws runtime config", () => {
  it("normalizes optional secrets and staff ids", () => {
    const runtime = readAwsRuntime({
      APP_ORIGIN: "https://coffee.example",
      MCP_SIGNING_KEY: "A".repeat(43),
      AUTH_SECRET: " secret-123 ",
      COFFEE_STAFF_USER_IDS: " staff-a, staff-b , , staff-a ",
    } satisfies AwsLambdaEnv);

    expect(Option.map(runtime.config.authSecret, Redacted.value)).toEqual(
      Option.some("secret-123"),
    );
    expect([...runtime.config.staffUserIds]).toEqual(["staff-a", "staff-b"]);
  });

  it("treats missing or blank optional values as absent", () => {
    const runtime = readAwsRuntime({
      APP_ORIGIN: "https://coffee.example",
      MCP_SIGNING_KEY: "A".repeat(43),
      AUTH_SECRET: " ",
      COFFEE_STAFF_USER_IDS: " ,  , ",
    } satisfies AwsLambdaEnv);

    expect(Option.isNone(runtime.config.authSecret)).toBe(true);
    expect([...runtime.config.staffUserIds]).toEqual([]);
  });
});

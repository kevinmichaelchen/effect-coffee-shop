/* oxlint-disable effect/effect-run-in-body, effect/avoid-native-object-helpers -- Tests execute the configuration boundary using the actor port's ReadonlySet. */
import { expect, it } from "vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { readAuthConfig } from "./config.ts";

it.each([
  "http://coffee.example",
  "https://coffee.example/path",
  "https://user:password@coffee.example",
  "https://coffee.example?origin=evil",
  "http://coffee.localhost:1365",
])("rejects an invalid public origin: %s", async (origin) => {
  const result = await Effect.runPromise(
    readAuthConfig(
      Option.some(Redacted.make("binding-secret-at-least-32-characters")),
      new Set<string>(),
    ).pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            APP_ORIGIN: origin,
            MCP_SIGNING_KEY: "A".repeat(43),
          }),
        ),
      ),
      Effect.result,
    ),
  );
  expect(result._tag).toBe("Failure");
});

it.each([
  { key: "A".repeat(43), expected: "Success" },
  { key: "A".repeat(42), expected: "Failure" },
  { key: "A".repeat(49), expected: "Failure" },
  { key: "invalid key with spaces", expected: "Failure" },
])("validates the OAuth signing key ($expected)", async ({ key, expected }) => {
  const result = await Effect.runPromise(
    readAuthConfig(
      Option.some(Redacted.make("binding-secret-at-least-32-characters")),
      new Set<string>(),
    ).pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            APP_ORIGIN: "http://localhost:5173",
            MCP_SIGNING_KEY: key,
          }),
        ),
      ),
      Effect.result,
    ),
  );
  expect(result._tag).toBe(expected);
});

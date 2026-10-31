import { describe, expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { readAuthConfig } from "./config.ts";

const readWith = (env: Record<string, string>) =>
  readAuthConfig(
    Option.some(Redacted.make("binding-secret-at-least-32-characters")),
    HashSet.empty(),
  ).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))), Effect.result);

describe("readAuthConfig", () => {
  [
    "http://coffee.example",
    "https://coffee.example/path",
    "https://user:password@coffee.example",
    "https://coffee.example?origin=evil",
    "http://coffee.localhost:1365",
  ].forEach((origin) => {
    it.effect(`rejects an invalid public origin: ${origin}`, () =>
      Effect.gen(function* () {
        const result = yield* readWith({ APP_ORIGIN: origin, MCP_SIGNING_KEY: "A".repeat(43) });
        expect(result._tag).toBe("Failure");
      }),
    );
  });

  [
    { key: "A".repeat(43), expected: "Success" },
    { key: "A".repeat(42), expected: "Failure" },
    { key: "A".repeat(49), expected: "Failure" },
    { key: "invalid key with spaces", expected: "Failure" },
  ].forEach(({ key, expected }) => {
    it.effect(`validates the OAuth signing key (${expected}, ${key.length} chars)`, () =>
      Effect.gen(function* () {
        const result = yield* readWith({
          APP_ORIGIN: "http://localhost:5173",
          MCP_SIGNING_KEY: key,
        });
        expect(result._tag).toBe(expected);
      }),
    );
  });
});

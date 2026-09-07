import { it } from "@effect/vitest";
import { expect } from "vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { cacheConfig } from "./config.ts";

it.effect("does not print malformed credentials in configuration errors", () =>
  Effect.gen(function* () {
    const secret = "invalid-secret-that-must-not-appear!";
    const result = yield* cacheConfig
      .parse(
        ConfigProvider.fromUnknown({
          CACHE_TEAM: "test",
          CACHE_WRITE_TOKEN: secret,
          CACHE_READ_TOKEN: "r".repeat(32),
        }),
      )
      .pipe(Effect.flip);
    expect(String(result)).toContain("CACHE_WRITE_TOKEN");
    expect(String(result)).not.toContain(secret);
  }),
);

it.effect("requires separate read and write credentials", () =>
  Effect.gen(function* () {
    const result = yield* cacheConfig
      .parse(
        ConfigProvider.fromUnknown({
          CACHE_TEAM: "test",
          CACHE_WRITE_TOKEN: "w".repeat(32),
          CACHE_READ_TOKEN: "w".repeat(32),
        }),
      )
      .pipe(Effect.flip);
    expect(String(result)).toContain("must differ");
  }),
);

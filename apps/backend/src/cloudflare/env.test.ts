import type {
  AiTextGenerationInput,
  AiTextGenerationOutput,
  D1Database,
} from "@cloudflare/workers-types";
import * as Option from "effect/Option";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  readCloudflareRuntime,
  type AssetFetcher,
  type CloudflareWorkerEnv,
  type WorkersAiBinding,
} from "./env.ts";

const makeAiBinding = (): WorkersAiBinding => ({
  run: async (_model: string, _inputs: AiTextGenerationInput): Promise<AiTextGenerationOutput> =>
    Promise.reject("not used in this test"),
});

const makeAssetFetcher = (): AssetFetcher => ({
  fetch: async () => new Response("ok"),
});

let database: D1Database;
let disposeMiniflare: () => Promise<void>;

describe("cloudflare runtime config", () => {
  beforeAll(async () => {
    const miniflare = new Miniflare({
      d1Databases: {
        DB: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      },
      modules: true,
      script: "",
    });

    database = await miniflare.getD1Database("DB");
    disposeMiniflare = async () => miniflare.dispose();
  });

  afterAll(async () => {
    await disposeMiniflare();
  });

  it("normalizes optional strings and staff ids", () => {
    const runtime = readCloudflareRuntime({
      AI: makeAiBinding(),
      AI_GATEWAY_ID: " gateway-123 ",
      ASSETS: makeAssetFetcher(),
      BETTER_AUTH_SECRET: " secret-123 ",
      COFFEE_STAFF_USER_IDS: " staff-a, staff-b , , staff-a ",
      DB: database,
    });

    expect(Option.isSome(runtime.bindings.ai)).toBe(true);
    expect(Option.isSome(runtime.bindings.assets)).toBe(true);
    expect(Option.getOrUndefined(runtime.config.aiGatewayId)).toBe("gateway-123");
    expect(Option.getOrUndefined(runtime.config.betterAuthSecret)).toBe("secret-123");
    expect([...runtime.config.staffUserIds]).toEqual(["staff-a", "staff-b"]);
  });

  it("treats missing or blank optional values as absent", () => {
    const runtime = readCloudflareRuntime({
      AI_GATEWAY_ID: "   ",
      BETTER_AUTH_SECRET: "",
      COFFEE_STAFF_USER_IDS: " ,  , ",
      DB: database,
    } satisfies CloudflareWorkerEnv);

    expect(Option.isNone(runtime.bindings.ai)).toBe(true);
    expect(Option.isNone(runtime.bindings.assets)).toBe(true);
    expect(Option.isNone(runtime.config.aiGatewayId)).toBe(true);
    expect(Option.isNone(runtime.config.betterAuthSecret)).toBe(true);
    expect([...runtime.config.staffUserIds]).toEqual([]);
  });
});

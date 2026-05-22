/**
 * Defines the Alchemy stack that deploys Coffee Shop to Cloudflare.
 *
 * @module
 */
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import {
  cloudflareBindingNames,
  cloudflareEnvNames,
} from "../../apps/backend/src/platforms/cloudflare/env.ts";
import { clampSamplingRate, coffeeStackName, uiBuild } from "./shared.ts";

const optionalSecret = (value: string | undefined) =>
  value === undefined || value.trim().length === 0 ? "" : Redacted.make(value);

const state = () =>
  process.env.ALCHEMY_LOCAL_STATE === "1" ? Alchemy.localState() : Cloudflare.state();

const betterAuthSecret = Effect.gen(function* () {
  const provided = optionalSecret(process.env.BETTER_AUTH_SECRET);

  if (provided !== "") {
    return provided;
  }

  const generated = yield* Alchemy.Random("better-auth-secret", {
    bytes: 32,
  });
  return generated.text;
});

export default Alchemy.Stack(
  coffeeStackName,
  {
    providers: Cloudflare.providers(),
    state: state(),
  },
  Effect.gen(function* () {
    const aiGatewayEnabled = process.env.COFFEE_ASSISTANT_AI_GATEWAY === "1";
    const observabilitySamplingRate = clampSamplingRate(
      yield* Config.number("COFFEE_OBSERVABILITY_SAMPLING_RATE").pipe(
        Config.withDefault(1),
        Effect.orDie,
      ),
    );

    const coffeeDb = yield* Cloudflare.D1Database("coffee-db", {
      migrationsDir: "./packages/coffee/external/sqlite/src/sql/migrations",
    });

    const assistantGateway = aiGatewayEnabled
      ? yield* Cloudflare.AiGateway("assistant", {
          authentication: true,
          collectLogs: true,
        })
      : undefined;

    const website = yield* Cloudflare.StaticSite("onion", {
      url: true,
      compatibility: {
        flags: ["nodejs_compat"],
      },
      main: "./apps/backend/src/platforms/cloudflare/worker.ts",
      observability: {
        enabled: true,
        headSamplingRate: observabilitySamplingRate,
        logs: {
          enabled: true,
          headSamplingRate: observabilitySamplingRate,
          invocationLogs: true,
          persist: true,
        },
        traces: {
          enabled: true,
          headSamplingRate: observabilitySamplingRate,
          persist: true,
        },
      },
      cwd: "apps/ui",
      command: uiBuild.command,
      outdir: uiBuild.output,
      memo: {
        include: [...uiBuild.include],
        lockfile: uiBuild.lockfile,
      },
      dev: {
        command: "bun run dev -- --host 127.0.0.1 --port 5173",
      },
      assetsConfig: {
        runWorkerFirst: ["/.well-known/agent-configuration", "/api", "/api/*", "/mcp", "/mcp/*"],
      },
      bindings: {
        [cloudflareBindingNames.db]: coffeeDb,
      },
      env: {
        [cloudflareEnvNames.aiGatewayId]: assistantGateway?.gatewayId ?? "",
        [cloudflareEnvNames.betterAuthSecret]: yield* betterAuthSecret,
        [cloudflareEnvNames.coffeeStaffUserIds]:
          process.env[cloudflareEnvNames.coffeeStaffUserIds] ?? "",
      },
    });

    yield* website.bind(cloudflareBindingNames.ai, {
      bindings: [{ type: "ai", name: cloudflareBindingNames.ai }],
    });

    return {
      assistantGateway: assistantGateway?.gatewayId ?? null,
      database: coffeeDb.databaseName,
      url: website.url,
    };
  }),
);

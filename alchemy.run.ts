import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

const optionalSecret = (value: string | undefined) =>
  value === undefined || value.trim().length === 0
    ? ""
    : Redacted.make(value);

const state = () =>
  process.env.ALCHEMY_LOCAL_STATE === "1"
    ? Alchemy.localState()
    : Cloudflare.state();

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
  "effect-v4-onion",
  {
    providers: Cloudflare.providers(),
    state: state(),
  },
  Effect.gen(function* () {
    const aiGatewayEnabled = process.env.COFFEE_ASSISTANT_AI_GATEWAY === "1";

    const coffeeDb = yield* Cloudflare.D1Database("coffee-db", {
      migrationsDir: "./domains/coffee/external-sqlite/src/sql/migrations",
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
      main: "./apps/backend/src/presentation/cloudflare/worker.ts",
      observability: {
        enabled: true,
        headSamplingRate: 1,
        logs: {
          enabled: true,
          headSamplingRate: 1,
          invocationLogs: true,
          persist: true,
        },
        traces: {
          enabled: true,
          headSamplingRate: 1,
          persist: true,
        },
      },
      cwd: "apps/ui",
      command: "bun run build",
      outdir: "dist",
      memo: {
        include: [
          "index.html",
          "package.json",
          "public/**",
          "src/**",
          "tsconfig*.json",
          "vite.config.*",
        ],
        lockfile: true,
      },
      dev: {
        command: "bun run dev -- --host 127.0.0.1 --port 5173",
      },
      assetsConfig: {
        runWorkerFirst: [
          "/.well-known/agent-configuration",
          "/api",
          "/api/*",
          "/mcp",
          "/mcp/*",
        ],
      },
      bindings: {
        DB: coffeeDb,
      },
      env: {
        AI_GATEWAY_ID: assistantGateway?.gatewayId ?? "",
        BETTER_AUTH_SECRET: yield* betterAuthSecret,
        COFFEE_STAFF_USER_IDS: process.env.COFFEE_STAFF_USER_IDS ?? "",
      },
    });

    yield* website.bind("AI", {
      bindings: [{ type: "ai", name: "AI" }],
    });

    return {
      assistantGateway: assistantGateway?.gatewayId ?? null,
      database: coffeeDb.databaseName,
      url: website.url,
    };
  }),
);

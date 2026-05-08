import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

const optionalSecret = (value: string | undefined) =>
  value === undefined || value.trim().length === 0
    ? ""
    : Redacted.make(value);

const state = () =>
  process.env.ALCHEMY_STATE_TOKEN
    ? Cloudflare.state()
    : Alchemy.localState();

export default Alchemy.Stack(
  "effect-v4-onion",
  {
    providers: Cloudflare.providers(),
    state: state(),
  },
  Effect.gen(function* () {
    const aiGatewayEnabled = process.env.COFFEE_ASSISTANT_AI_GATEWAY === "1";

    const coffeeDb = yield* Cloudflare.D1Database("coffee-db");

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
      command: "bun run --cwd apps/ui build",
      outdir: "./apps/ui/dist",
      dev: {
        command: "bun run --cwd apps/ui dev -- --host 127.0.0.1 --port 5173",
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
        BETTER_AUTH_SECRET: optionalSecret(process.env.BETTER_AUTH_SECRET),
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

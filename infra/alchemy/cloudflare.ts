/**
 * Defines the Alchemy stack that deploys Coffee Shop to Cloudflare.
 *
 * @module
 */
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  cloudflareAssistantGatewayId,
  cloudflareBindingNames,
  cloudflareEnvNames,
} from "@effect-coffee-shop/coffee-runtime-cloudflare/env";
import {
  booleanWithDefault,
  numberBetweenWithDefault,
  optionalTrimmedRedacted,
  optionalTrimmedString,
  stringWithDefault,
} from "./config.ts";
import { coffeeStackName, uiBuild } from "./shared.ts";

const state = () =>
  process.env.ALCHEMY_LOCAL_STATE === "1" ? Alchemy.localState() : Cloudflare.state();

class DeploySmokeCheckError extends Data.TaggedError("DeploySmokeCheckError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const encodeJsonString = Schema.encodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

const betterAuthSecret = Effect.gen(function* () {
  const provided = yield* optionalTrimmedRedacted(cloudflareEnvNames.betterAuthSecret);

  if (provided !== undefined) {
    return provided;
  }

  const generated = yield* Alchemy.Random("better-auth-secret", {
    bytes: 32,
  });
  return generated.text;
});

const fetchSmokeResponse = (input: {
  readonly init?: RequestInit;
  readonly label: string;
  readonly url: string;
}) =>
  Effect.tryPromise({
    try: () => fetch(input.url, input.init),
    catch: (cause) =>
      new DeploySmokeCheckError({
        message: `Unable to run ${input.label} smoke check for ${input.url}.`,
        cause,
      }),
  });

const requireOkSmokeResponse = (input: {
  readonly label: string;
  readonly response: Response;
  readonly url: string;
}) =>
  input.response.ok
    ? Effect.void
    : Effect.fail(
        new DeploySmokeCheckError({
          message: `${input.label} smoke check failed for ${input.url}: ${input.response.status} ${input.response.statusText}`,
        }),
      );

const CloudflareDeploymentSmokeCheck = Alchemy.Action(
  "CloudflareDeploymentSmokeCheck",
  Effect.fn("CloudflareDeploymentSmokeCheck")(function* (input: {
    readonly enabled: boolean;
    readonly mcpEnabled: boolean;
    readonly url: string;
  }) {
    if (!input.enabled) {
      return {
        checked: false,
        mcpChecked: false,
      };
    }

    const healthUrl = new URL("/api/health", input.url).toString();
    const health = yield* fetchSmokeResponse({
      label: "HTTP health",
      url: healthUrl,
    });
    yield* requireOkSmokeResponse({
      label: "HTTP health",
      response: health,
      url: healthUrl,
    });

    if (!input.mcpEnabled) {
      return {
        checked: true,
        mcpChecked: false,
      };
    }

    const mcpUrl = new URL("/mcp", input.url).toString();
    const mcp = yield* fetchSmokeResponse({
      init: {
        body: encodeJsonString({
          id: "deploy-smoke",
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            capabilities: {},
            clientInfo: {
              name: "alchemy-deploy-smoke",
              version: "1.0.0",
            },
            protocolVersion: "2025-06-18",
          },
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
      label: "MCP initialize",
      url: mcpUrl,
    });
    yield* requireOkSmokeResponse({
      label: "MCP initialize",
      response: mcp,
      url: mcpUrl,
    });

    return {
      checked: true,
      mcpChecked: true,
    };
  }),
);

export default Alchemy.Stack(
  coffeeStackName,
  {
    providers: Cloudflare.providers(),
    state: state(),
  },
  Effect.gen(function* () {
    const aiGatewayEnabled = yield* booleanWithDefault("COFFEE_ASSISTANT_AI_GATEWAY", false);
    const deploySmokeChecksEnabled = yield* booleanWithDefault("COFFEE_DEPLOY_SMOKE_CHECKS", false);
    const deployMcpSmokeCheckEnabled = yield* booleanWithDefault("COFFEE_DEPLOY_SMOKE_MCP", false);
    const assistantModel = yield* optionalTrimmedString(cloudflareEnvNames.coffeeAssistantModel);
    const observabilitySamplingRate = yield* numberBetweenWithDefault({
      defaultValue: 1,
      maximum: 1,
      minimum: 0,
      name: "COFFEE_OBSERVABILITY_SAMPLING_RATE",
    });

    const coffeeDb = yield* Cloudflare.D1Database("coffee-db", {
      migrationsDir: "./packages/coffee/external/sqlite/src/sql/migrations",
    });
    const secretsStore = yield* Cloudflare.SecretsStore("coffee-secrets");
    const betterAuthStoreSecret = yield* Cloudflare.Secret(cloudflareEnvNames.betterAuthSecret, {
      comment: "Better Auth signing secret for the Coffee Shop Cloudflare Worker.",
      name: cloudflareEnvNames.betterAuthSecret,
      store: secretsStore,
      value: yield* betterAuthSecret,
    });

    const assistantGateway = aiGatewayEnabled
      ? yield* Cloudflare.AiGateway(cloudflareBindingNames.aiGateway, {
          authentication: true,
          collectLogs: true,
          id: cloudflareAssistantGatewayId,
        })
      : undefined;

    const website = yield* Cloudflare.StaticSite("onion", {
      url: true,
      compatibility: {
        flags: ["nodejs_compat"],
      },
      main: "./apps/backend/src/cloudflare/worker.ts",
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
        [cloudflareEnvNames.coffeeAssistantModel]: assistantModel ?? "",
        [cloudflareEnvNames.coffeeStaffUserIds]: yield* stringWithDefault(
          cloudflareEnvNames.coffeeStaffUserIds,
          "",
        ),
      },
    });

    yield* website.bind(cloudflareEnvNames.betterAuthSecret, {
      bindings: [
        {
          type: "secrets_store_secret",
          name: cloudflareEnvNames.betterAuthSecret,
          secretName: betterAuthStoreSecret.secretName,
          storeId: betterAuthStoreSecret.storeId,
        },
      ],
    });

    yield* website.bind(cloudflareBindingNames.ai, {
      bindings: [{ type: "ai", name: cloudflareBindingNames.ai }],
    });

    const smoke = yield* CloudflareDeploymentSmokeCheck({
      enabled: deploySmokeChecksEnabled,
      mcpEnabled: deployMcpSmokeCheckEnabled,
      url: website.url.as<string>(),
    });

    return {
      assistantGateway: assistantGateway?.gatewayId ?? null,
      database: coffeeDb.databaseName,
      smoke,
      url: website.url,
    };
  }),
);

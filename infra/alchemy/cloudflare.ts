/**
 * Defines the Alchemy stack that deploys Coffee Shop to Cloudflare.
 *
 * @module
 */
import * as Alchemy from "alchemy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import type * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import CoffeeWorker from "@effect-coffee-shop/coffee-server/CoffeeWorker";
import { booleanWithDefault, numberBetweenWithDefault } from "./config.ts";
import { coffeeStackName } from "./shared.ts";

// The state layer reads its backend choice from Config when Alchemy builds it.
const state = Layer.unwrap(
  Config.String("ALCHEMY_LOCAL_STATE").pipe(
    Config.withDefault(""),
    Effect.orDie,
    Effect.map((local) => (local === "1" ? Alchemy.localState() : Cloudflare.state())),
  ),
);

class DeploySmokeCheckError extends Schema.TaggedError<
  DeploySmokeCheckError,
  { readonly brand: unique symbol }
>()("DeploySmokeCheckError", {
  message: Schema.String,
  cause: Schema.optionalKey(Schema.Unknown),
}) {}

const fetchSmokeResponse = (input: {
  readonly method?: "GET" | "POST";
  readonly label: string;
  readonly url: string;
}) =>
  HttpClient.execute(HttpClientRequest.make(input.method ?? "GET")(input.url)).pipe(
    Effect.mapError(
      (cause) =>
        new DeploySmokeCheckError({
          message: `Unable to run ${input.label} smoke check for ${input.url}.`,
          cause,
        }),
    ),
  );

const requireOkSmokeResponse = (input: {
  readonly label: string;
  readonly response: HttpClientResponse.HttpClientResponse;
  readonly url: string;
}) =>
  input.response.status >= 200 && input.response.status < 300
    ? Effect.void
    : Effect.fail(
        new DeploySmokeCheckError({
          message: `${input.label} smoke check failed for ${input.url}: ${input.response.status}`,
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
      method: "POST",
      label: "MCP OAuth discovery",
      url: mcpUrl,
    });
    if (mcp.status !== 401 || (mcp.headers["www-authenticate"] ?? "") === "") {
      return yield* new DeploySmokeCheckError({
        message: "MCP must reject unauthenticated requests with OAuth discovery.",
      });
    }

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
    state,
  },
  Effect.gen(function* () {
    // Alchemy resolves relative paths against the working directory, which is
    // the repository root for the `alchemy` CLI scripts but this workspace when
    // Turbo runs the smoke test, so cross-workspace paths are anchored on the
    // module location instead.
    const path = yield* Path.Path;
    const repoRoot = yield* path.fromFileUrl(new URL("../../", import.meta.url)).pipe(Effect.orDie);
    const deploySmokeChecksEnabled = yield* booleanWithDefault("COFFEE_DEPLOY_SMOKE_CHECKS", false);
    const deployMcpSmokeCheckEnabled = yield* booleanWithDefault("COFFEE_DEPLOY_SMOKE_MCP", false);
    const observabilitySamplingRate = yield* numberBetweenWithDefault({
      defaultValue: 1,
      maximum: 1,
      minimum: 0,
      name: "COFFEE_OBSERVABILITY_SAMPLING_RATE",
    });

    // The backend: the domain model on Durable Objects, auth on D1, REST and
    // MCP. It reads APP_ORIGIN, MCP_SIGNING_KEY, MCP_CLIENTS,
    // COFFEE_STAFF_USER_IDS and AUTH_SECRET from this environment.
    const api = yield* CoffeeWorker;

    // The app: the Vite build, and a small Worker that forwards the backend's
    // paths to it over a service binding, so the app and the Apis share one
    // origin and the session cookie stays first-party.
    const website = yield* Cloudflare.Website.Vite("onion", {
      rootDir: path.join(repoRoot, "apps/ui"),
      main: "src/worker.ts",
      observability: {
        enabled: true,
        headSamplingRate: observabilitySamplingRate,
        logs: {
          enabled: true,
          headSamplingRate: observabilitySamplingRate,
          invocationLogs: true,
          persist: true,
        },
      },
      memo: {
        workspaces: "auto",
      },
      assets: {
        runWorkerFirst: [
          "/sync/*",
          "/api",
          "/api/*",
          "/mcp",
          "/mcp/*",
          "/oauth/*",
          "/.well-known/*",
        ],
      },
      env: {
        COFFEE: api,
      },
    });

    const smoke = yield* CloudflareDeploymentSmokeCheck({
      enabled: deploySmokeChecksEnabled,
      mcpEnabled: deployMcpSmokeCheckEnabled,
      url: website.url.as<string>(),
    });

    return {
      api: api.url,
      smoke,
      url: website.url,
    };
  }),
);

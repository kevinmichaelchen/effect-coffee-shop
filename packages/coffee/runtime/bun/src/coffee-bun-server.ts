/**
 * Runs the composed Coffee backend with the Bun HTTP server adapter.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { createHttpRouter } from "@effect-coffee-shop/http-routing/router";
import { routeResponse, type HttpRoute } from "@effect-coffee-shop/http-routing/route";
import { runHttpRequest } from "@effect-coffee-shop/http-routing/observability";
import type { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { createCoffeeWebHandler } from "@effect-coffee-shop/coffee-http/web-handler";

import { readAuthConfig } from "@effect-coffee-shop/coffee-auth/config";
import { handleCoffeeRequest } from "@effect-coffee-shop/coffee-backend/http/backend";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";
import { transactionalAuthDatabase } from "@effect-coffee-shop/coffee-auth/database";
import {
  optionalTrimmedRedactedString,
  parseCsvSet,
} from "@effect-coffee-shop/coffee-runtime-shared/env";

export type CoffeeWebHandlerInput = Parameters<typeof createCoffeeWebHandler>;
export type CoffeeRoutesLayer = typeof CoffeeHttpApiLive;
export type CoffeeAppLayer = CoffeeWebHandlerInput[1];
// oxlint-disable-next-line effect/prefer-option-over-null -- Native environment adapter accepts/emits undefined; decoded runtime configuration uses Option.
export type CoffeeBunEnv = Record<string, string | undefined>;

export type BunHttpRoute = HttpRoute<CoffeeBunEnv>;

class InvalidBunServerPortError extends Schema.TaggedError<InvalidBunServerPortError>()(
  "InvalidBunServerPortError",
  {
    message: Schema.String,
  },
) {}

export async function startCoffeeBunServer(input: {
  readonly appLayer: CoffeeAppLayer;
  readonly extraRoutes?: ReadonlyArray<BunHttpRoute>;
  readonly portEnv?: string;
  readonly routes: CoffeeRoutesLayer;
}): Promise<void> {
  // oxlint-disable-next-line effect/effect-run-in-body -- Native Promise/callback boundary owns running this Effect; application effects stay composed.
  const port = await Effect.runPromise(readPort(input.portEnv ?? "COFFEE_HTTP_PORT"));
  const database = Layer.unwrap(
    Effect.promise(() => import("@effect-coffee-shop/coffee-external-sqlite/bun")).pipe(
      Effect.map(({ BunCoffeeDatabaseLive }) => BunCoffeeDatabaseLive),
    ),
  );
  // oxlint-disable-next-line effect/effect-run-in-body -- Bun entrypoint decodes configuration before serving.
  const auth = await Effect.runPromise(
    readAuthConfig(
      optionalTrimmedRedactedString(Bun.env.AUTH_SECRET, "AUTH_SECRET"),
      parseCsvSet(Bun.env.COFFEE_STAFF_USER_IDS),
    ),
  );
  const handleHttpRequest = createHttpRouter<CoffeeBunEnv>([
    ...(input.extraRoutes ?? []),
    {
      name: "routes",
      matches: () => true,
      handle: ({ request }) =>
        handleCoffeeRequest({
          request,
          auth,
          database: transactionalAuthDatabase(database),
          appLayer: input.appLayer,
          httpRoutes: input.routes,
          mcpRoutes: CoffeeMcpHttpLive,
        }).pipe(Effect.map(routeResponse)),
    },
  ]);
  const server = Bun.serve({
    port,
    fetch: async (request) => runHttpRequest(request, handleHttpRequest(request, Bun.env)),
  });

  registerShutdown(async () => {}, server);
  // oxlint-disable-next-line effect/effect-run-in-body -- Native Promise/callback boundary owns running this Effect; application effects stay composed.
  await Effect.runPromise(
    Effect.logInfo("Coffee HTTP server listening").pipe(
      Effect.annotateLogs("url", String(server.url)),
    ),
  );
}

function readPort(envName: string) {
  const fallbackPort = 3000;
  return Option.match(Option.fromUndefinedOr(Bun.env[envName]), {
    onNone: () => Effect.succeed(fallbackPort),
    onSome: (configuredPort) => {
      const parsedPort = Number(configuredPort);
      return Option.match(
        Option.liftPredicate(parsedPort, (port) => Number.isInteger(port) && port > 0),
        {
          onNone: () =>
            Effect.fail(
              new InvalidBunServerPortError({
                message: `Invalid ${envName} value: ${configuredPort}`,
              }),
            ),
          onSome: Effect.succeed,
        },
      );
    },
  });
}

function registerShutdown(
  dispose: () => Promise<void>,
  server: {
    stop(): void;
  },
): void {
  const shutdown = async () => {
    server.stop();
    await dispose();
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

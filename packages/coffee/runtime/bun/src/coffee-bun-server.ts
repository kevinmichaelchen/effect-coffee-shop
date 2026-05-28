/**
 * Runs the composed Coffee backend with the Bun HTTP server adapter.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { createHttpRouter } from "@effect-coffee-shop/http-routing/router";
import { routeResponse, type HttpRoute } from "@effect-coffee-shop/http-routing/route";
import { runHttpEffect } from "@effect-coffee-shop/http-routing/observability";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { createCoffeeRequestServices } from "@effect-coffee-shop/coffee-backend/http/backend";
import { createCoffeeWebHandler } from "@effect-coffee-shop/coffee-http/web-handler";

type CoffeeWebHandlerInput = Parameters<typeof createCoffeeWebHandler>;
type CoffeeRoutesLayer = CoffeeWebHandlerInput[0];
type CoffeeAppLayer = CoffeeWebHandlerInput[1];
type CoffeeBunEnv = Record<string, string | undefined>;

export type BunHttpRoute = HttpRoute<CoffeeBunEnv>;

class InvalidBunServerPortError extends Schema.TaggedErrorClass<InvalidBunServerPortError>()(
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
  const port = await Effect.runPromise(readPort(input.portEnv ?? "COFFEE_HTTP_PORT"));
  const { dispose, handler } = createCoffeeWebHandler(input.routes, input.appLayer);
  const handleHttpRequest = createHttpRouter<CoffeeBunEnv>([
    ...(input.extraRoutes ?? []),
    {
      name: "routes",
      matches: () => true,
      handle: ({ request }) =>
        Effect.promise(async () => handler(request, createCoffeeRequestServices(systemActor))).pipe(
          Effect.map(routeResponse),
        ),
    },
  ]);
  const server = Bun.serve({
    port,
    fetch: async (request) => runHttpEffect(handleHttpRequest(request, Bun.env)),
  });

  registerShutdown(dispose, server);
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

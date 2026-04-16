import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import {
  getAssistantModel,
  getBunAssistantAiConfig,
  handleAssistantRequest,
} from "#presentation/assistant/handler";
import { CurrentActor, systemActor } from "#service/CurrentActor";
import { createCoffeeWebHandler, emptyWebHandlerServices } from "./web-handler.ts";

export async function startCoffeeBunServer<
  TAppLayer extends Layer.Layer<never, any, any>,
  TRoutes extends Layer.Layer<never, any, any>,
>(input: {
  readonly appLayer: TAppLayer;
  readonly portEnv?: string;
  readonly routes: TRoutes;
}): Promise<void> {
  const port = await readPort(input.portEnv ?? "COFFEE_HTTP_PORT");
  const { dispose, handler } = createCoffeeWebHandler(input.routes, input.appLayer);
  const server = Bun.serve({
    port,
    fetch: async (request) => {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/assistant") {
        return handleAssistantRequest(request, {
          actor: systemActor,
          ai: getBunAssistantAiConfig(Bun.env),
          appLayer: input.appLayer,
          model: getAssistantModel(Bun.env),
        });
      }

      return handler(
        request,
        emptyWebHandlerServices().pipe(Context.add(CurrentActor, systemActor)),
      );
    },
  });

  registerShutdown(dispose, server);
  console.warn(
    "[auth] Bun dev server grants system-level (staff) privileges to every request. " +
      "Do not expose this server on an untrusted network.",
  );
  console.log(`Coffee HTTP server listening on ${server.url}`);
}

async function readPort(envName: string): Promise<number> {
  const fallbackPort = 3000;
  const configuredPort = Bun.env[envName];
  if (configuredPort === undefined) {
    return fallbackPort;
  }

  const parsedPort = Number(configuredPort);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error(`Invalid ${envName} value: ${configuredPort}`);
  }

  return parsedPort;
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

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import {
  createAssistantModelRunnerLayer,
  getAssistantModel,
  getBunAssistantAiConfig,
  handleAssistantRequest,
} from "@effect-coffee-shop/coffee-assistant/handler";
import { emptyWebHandlerServices } from "@effect-coffee-shop/backend-host/request-services";
import {
  CurrentActor,
  systemActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { createCoffeeWebHandler } from "./web-handler.ts";

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
        const ai = getBunAssistantAiConfig(Bun.env);
        const modelLayer = Option.match(Option.fromNullishOr(ai), {
          onNone: () => undefined,
          onSome: createAssistantModelRunnerLayer,
        });

        return handleAssistantRequest(request, {
          actor: systemActor,
          appLayer: input.appLayer,
          model: getAssistantModel(Bun.env, ai),
          modelLayer,
        });
      }

      return handler(
        request,
        emptyWebHandlerServices().pipe(Context.add(CurrentActor, systemActor)),
      );
    },
  });

  registerShutdown(dispose, server);
  await Effect.runPromise(
    Effect.logInfo("Coffee HTTP server listening").pipe(
      Effect.annotateLogs("url", String(server.url)),
    ),
  );
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

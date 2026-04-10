import type {
  AiTextGenerationInput,
  AiTextGenerationOutput,
  D1Database,
} from "@cloudflare/workers-types";
import * as Layer from "effect/Layer";
import { getAssistantModel, handleAssistantRequest } from "#presentation/assistant/handler";
import { CoffeeHttpApiLive } from "#presentation/http/api";
import { createCoffeeWebHandler } from "#presentation/http/web-handler";
import { CoffeeMcpHttpLive } from "#presentation/mcp/server";
import { makeCloudflareCoffeeAppLive } from "#runtime/cloudflare/live";

type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
};

interface WorkersAiBinding {
  run(
    model: string,
    inputs: AiTextGenerationInput,
    options?: Record<string, unknown>,
  ): Promise<AiTextGenerationOutput>;
  gateway(gatewayId: string): unknown;
}

export interface OnionCloudflareWorkerEnv {
  AI?: WorkersAiBinding;
  DB: D1Database;
  ASSETS?: AssetFetcher;
}

const isApiRequest = (pathname: string) => pathname === "/api" || pathname.startsWith("/api/");

const isMcpRequest = (pathname: string) => pathname === "/mcp" || pathname.startsWith("/mcp/");

const isAssistantRequest = (pathname: string) =>
  pathname === "/api/assistant" || pathname === "/api/assistant/";

const rewriteApiRequest = (request: Request) => {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  return new Request(url, request);
};

const makeBackendHandler = (db: D1Database) => {
  return createCoffeeWebHandler(
    Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive),
    makeCloudflareCoffeeAppLive(db),
  );
};

type WorkerHandler = ReturnType<typeof makeBackendHandler>["handler"];

let cachedHandler:
  | {
      db: D1Database;
      dispose: () => Promise<void>;
      handler: WorkerHandler;
    }
  | undefined;

const getBackendHandler = (db: D1Database): WorkerHandler => {
  switch (cachedHandler?.db) {
    case db:
      return cachedHandler.handler;
    default:
      break;
  }

  void cachedHandler?.dispose();

  const next = makeBackendHandler(db);
  cachedHandler = {
    db,
    dispose: next.dispose,
    handler: next.handler,
  };

  return next.handler;
};

const notFoundResponse = () => new Response("Not Found", { status: 404 });

const getAssistantAiConfig = (env: OnionCloudflareWorkerEnv) => {
  switch (env.AI) {
    case undefined:
      return undefined;
    default:
      return { binding: env.AI };
  }
};

const routeRequest = async (request: Request, env: OnionCloudflareWorkerEnv): Promise<Response> => {
  const pathname = new URL(request.url).pathname;

  switch (true) {
    case isAssistantRequest(pathname):
      return handleAssistantRequest(rewriteApiRequest(request), {
        ai: getAssistantAiConfig(env),
        appLayer: makeCloudflareCoffeeAppLive(env.DB),
        model: getAssistantModel(),
      });
    case isApiRequest(pathname):
      return getBackendHandler(env.DB)(rewriteApiRequest(request));
    case isMcpRequest(pathname):
      return getBackendHandler(env.DB)(request);
    case env.ASSETS !== undefined:
      return env.ASSETS.fetch(request);
    default:
      return notFoundResponse();
  }
};

export default {
  async fetch(request: Request, env: OnionCloudflareWorkerEnv) {
    return routeRequest(request, env);
  },
};

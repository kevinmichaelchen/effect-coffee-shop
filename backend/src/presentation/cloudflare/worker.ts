import type {
  AiTextGenerationInput,
  AiTextGenerationOutput,
  D1Database,
} from "@cloudflare/workers-types";
import * as Layer from "effect/Layer";
import * as ServiceMap from "effect/ServiceMap";
import { getAssistantModel, handleAssistantRequest } from "#presentation/assistant/handler";
import {
  createCloudflareAuth,
  ensureCloudflareAuthPersistence,
  resolveCloudflareActor,
} from "#presentation/auth/server";
import { CoffeeHttpApiLive } from "#presentation/http/api";
import { createCoffeeWebHandler, emptyWebHandlerServices } from "#presentation/http/web-handler";
import { CoffeeMcpHttpLive } from "#presentation/mcp/server";
import { makeCloudflareCoffeeAppLive } from "#runtime/cloudflare/live";
import { CurrentActor, type AppActor, systemActor } from "#service/CurrentActor";

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
  BETTER_AUTH_SECRET?: string;
  COFFEE_STAFF_USER_IDS?: string;
  DB: D1Database;
  ASSETS?: AssetFetcher;
}

const isApiRequest = (pathname: string) => pathname === "/api" || pathname.startsWith("/api/");

const isMcpRequest = (pathname: string) => pathname === "/mcp" || pathname.startsWith("/mcp/");

const isAssistantRequest = (pathname: string) =>
  pathname === "/api/assistant" || pathname === "/api/assistant/";

const isAgentDiscoveryRequest = (pathname: string) =>
  pathname === "/.well-known/agent-configuration";

const isAuthRequest = (pathname: string) =>
  pathname === "/api/auth" || pathname.startsWith("/api/auth/");

const rewriteApiRequest = (request: Request) => {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  return new Request(url, request);
};

const rewriteToAuthPath = (request: Request, pathname: string) => {
  const url = new URL(request.url);
  url.pathname = pathname;
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

const betterAuthUnavailableResponse = () =>
  new Response("Better Auth is unavailable. Configure BETTER_AUTH_SECRET.", {
    status: 503,
  });

const hasBetterAuthSecret = (secret: string | undefined) => (secret?.trim() ?? "") !== "";

const getAssistantAiConfig = (env: OnionCloudflareWorkerEnv) => {
  switch (env.AI) {
    case undefined:
      return undefined;
    default:
      return { binding: env.AI };
  }
};

const createRequestServices = (actor: AppActor) =>
  emptyWebHandlerServices().pipe(ServiceMap.add(CurrentActor, actor));

const ensureWorkerPersistence = async (
  request: Request,
  env: OnionCloudflareWorkerEnv,
): Promise<void> => {
  const pathname = new URL(request.url).pathname;

  if (
    !isAgentDiscoveryRequest(pathname) &&
    !isAuthRequest(pathname) &&
    !isApiRequest(pathname) &&
    !isAssistantRequest(pathname) &&
    !isMcpRequest(pathname)
  ) {
    return;
  }

  await ensureCloudflareAuthPersistence({
    db: env.DB,
    secret: env.BETTER_AUTH_SECRET,
  });
};

const resolveRequestActor = async (
  request: Request,
  env: OnionCloudflareWorkerEnv,
): Promise<AppActor> =>
  resolveCloudflareActor({
    db: env.DB,
    request,
    secret: env.BETTER_AUTH_SECRET,
    staffUserIds: env.COFFEE_STAFF_USER_IDS,
  });

const handleBetterAuthRequest = (
  request: Request,
  env: OnionCloudflareWorkerEnv,
  pathname: string,
): Response | Promise<Response> | undefined => {
  if (!isAuthRequest(pathname) && !isAgentDiscoveryRequest(pathname)) {
    return undefined;
  }

  if (!hasBetterAuthSecret(env.BETTER_AUTH_SECRET)) {
    return betterAuthUnavailableResponse();
  }

  const auth = createCloudflareAuth({
    db: env.DB,
    request,
    secret: env.BETTER_AUTH_SECRET,
  });

  return isAuthRequest(pathname)
    ? auth.handler(request)
    : auth.handler(rewriteToAuthPath(request, "/api/auth/agent-configuration"));
};

const routeRequest = async (request: Request, env: OnionCloudflareWorkerEnv): Promise<Response> => {
  const pathname = new URL(request.url).pathname;
  await ensureWorkerPersistence(request, env);

  const betterAuthResponse = handleBetterAuthRequest(request, env, pathname);

  if (betterAuthResponse !== undefined) {
    return betterAuthResponse;
  }

  if (isAssistantRequest(pathname)) {
    return handleAssistantRequest(rewriteApiRequest(request), {
      actor: await resolveRequestActor(request, env),
      ai: getAssistantAiConfig(env),
      appLayer: makeCloudflareCoffeeAppLive(env.DB),
      model: getAssistantModel(),
    });
  }

  if (isApiRequest(pathname)) {
    return getBackendHandler(env.DB)(
      rewriteApiRequest(request),
      createRequestServices(await resolveRequestActor(request, env)),
    );
  }

  if (isMcpRequest(pathname)) {
    return getBackendHandler(env.DB)(request, createRequestServices(systemActor));
  }

  if (env.ASSETS !== undefined) {
    return env.ASSETS.fetch(request);
  }

  return notFoundResponse();
};

export default {
  async fetch(request: Request, env: OnionCloudflareWorkerEnv) {
    return routeRequest(request, env);
  },
};

import type {
  AiTextGenerationInput,
  AiTextGenerationOutput,
  D1Database,
} from "@cloudflare/workers-types";
import * as Layer from "effect/Layer";
import * as ServiceMap from "effect/ServiceMap";
import { getAssistantModel, handleAssistantRequest } from "#presentation/assistant/handler";
import type { AssistantAiConfig } from "#presentation/assistant/runtime";
import {
  createCloudflareAuth,
  ensureCloudflareAuthPersistence,
  resolveCloudflareActor,
} from "#presentation/auth/server";
import { CoffeeHttpApiLive } from "#presentation/http/api";
import { createCoffeeWebHandler, emptyWebHandlerServices } from "#presentation/http/web-handler";
import { CoffeeMcpHttpLive } from "#presentation/mcp/server";
import {
  logRequestCompleted,
  logRequestFailed,
  routeKindFromPathname,
  type RequestRouteKind,
} from "#presentation/observability/logging";
import { makeCloudflareCoffeeAppLive } from "#runtime/cloudflare/live";
import { CurrentActor, type AppActor, systemActor } from "#service/CurrentActor";

type AssetFetcher = { fetch(request: Request): Promise<Response> };

interface WorkersAiBinding {
  run(
    model: string,
    inputs: AiTextGenerationInput,
    options?: Record<string, unknown>,
  ): Promise<AiTextGenerationOutput>;
}

export interface OnionCloudflareWorkerEnv {
  AI?: WorkersAiBinding;
  AI_GATEWAY_ID?: string;
  BETTER_AUTH_SECRET?: string;
  COFFEE_STAFF_USER_IDS?: string;
  DB: D1Database;
  ASSETS?: AssetFetcher;
}

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

const makeBackendHandler = (db: D1Database) =>
  createCoffeeWebHandler(
    Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive),
    makeCloudflareCoffeeAppLive(db),
  );

type WorkerHandler = ReturnType<typeof makeBackendHandler>["handler"];
type RoutedResponse = { readonly actor: AppActor | undefined; readonly response: Response };

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
  new Response("Better Auth is unavailable. Configure BETTER_AUTH_SECRET.", { status: 503 });

const hasBetterAuthSecret = (secret: string | undefined) => (secret?.trim() ?? "") !== "";

const getAssistantAiConfig = (env: OnionCloudflareWorkerEnv): AssistantAiConfig | undefined => {
  if (env.AI === undefined) {
    return undefined;
  }

  const gatewayId = env.AI_GATEWAY_ID?.trim();

  return gatewayId === undefined || gatewayId === ""
    ? { binding: env.AI, kind: "binding" }
    : { binding: env.AI, gatewayId, kind: "binding" };
};

const createRequestServices = (actor: AppActor) =>
  emptyWebHandlerServices().pipe(ServiceMap.add(CurrentActor, actor));

const ensureWorkerPersistence = async (
  routeKind: RequestRouteKind,
  env: OnionCloudflareWorkerEnv,
): Promise<void> => {
  if (routeKind === "assets") {
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
  routeKind: RequestRouteKind,
): Response | Promise<Response> | undefined => {
  if (routeKind !== "auth" && routeKind !== "agent-discovery") {
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

  return routeKind === "auth"
    ? auth.handler(request)
    : auth.handler(rewriteToAuthPath(request, "/api/auth/agent-configuration"));
};

const logAndReturnResponse = (input: {
  readonly actor: AppActor | undefined;
  readonly durationMs: number;
  readonly request: Request;
  readonly response: Response;
  readonly routeKind: RequestRouteKind;
}) => {
  logRequestCompleted(input);
  return input.response;
};

const dispatchRoutedRequest = async (
  request: Request,
  env: OnionCloudflareWorkerEnv,
  routeKind: RequestRouteKind,
): Promise<RoutedResponse> => {
  const betterAuthResponse = handleBetterAuthRequest(request, env, routeKind);

  if (betterAuthResponse !== undefined) {
    return {
      actor: undefined,
      response: await betterAuthResponse,
    };
  }

  if (routeKind === "assistant") {
    const actor = await resolveRequestActor(request, env);
    return {
      actor,
      response: await handleAssistantRequest(rewriteApiRequest(request), {
        actor,
        ai: getAssistantAiConfig(env),
        appLayer: makeCloudflareCoffeeAppLive(env.DB),
        model: getAssistantModel(),
      }),
    };
  }

  if (routeKind === "api") {
    const actor = await resolveRequestActor(request, env);
    return {
      actor,
      response: await getBackendHandler(env.DB)(
        rewriteApiRequest(request),
        createRequestServices(actor),
      ),
    };
  }

  if (routeKind === "mcp") {
    return {
      actor: undefined,
      response: await getBackendHandler(env.DB)(request, createRequestServices(systemActor)),
    };
  }

  return {
    actor: undefined,
    response: env.ASSETS === undefined ? notFoundResponse() : await env.ASSETS.fetch(request),
  };
};

export const routeCloudflareRequest = async (
  request: Request,
  env: OnionCloudflareWorkerEnv,
): Promise<Response> => {
  const routeKind = routeKindFromPathname(new URL(request.url).pathname);
  const startedAt = performance.now();

  try {
    await ensureWorkerPersistence(routeKind, env);
    const { actor, response } = await dispatchRoutedRequest(request, env, routeKind);
    return logAndReturnResponse({
      actor,
      durationMs: performance.now() - startedAt,
      request,
      response,
      routeKind,
    });
  } catch (error) {
    logRequestFailed({
      actor: undefined,
      durationMs: performance.now() - startedAt,
      error,
      request,
      routeKind,
    });
    throw error;
  }
};

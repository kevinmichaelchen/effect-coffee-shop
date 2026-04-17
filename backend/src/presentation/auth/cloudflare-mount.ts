import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import {
  createAuth,
  ensureAuthPersistence,
  type AuthDependencies,
} from "#presentation/auth/server";
import {
  readCloudflareRuntime,
  type CloudflareRuntime,
  type CloudflareWorkerEnv,
} from "#presentation/cloudflare/context";
import {
  cloudflarePathname,
  cloudflareResponse,
  rewriteRequestPath,
  type CloudflareMount,
} from "#presentation/cloudflare/mount";
import { makeCloudflareCoffeeAppLive } from "#runtime/cloudflare/live";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";

interface CloudflareAuthDependencies extends AuthDependencies {
  readonly staffUserIds: ReadonlySet<string>;
}

export function buildCloudflareAuthDependencies(
  runtime: CloudflareRuntime,
): CloudflareAuthDependencies {
  const d1 = runtime.bindings.db;
  return {
    db: d1,
    makeAppLayer: () => CoffeeOrderApp.layer.pipe(Layer.provide(makeCloudflareCoffeeAppLive(d1))),
    secret: Option.getOrUndefined(runtime.config.betterAuthSecret),
    staffUserIds: runtime.config.staffUserIds,
  };
}

const betterAuthUnavailableResponse = () =>
  new Response("Better Auth is unavailable. Configure BETTER_AUTH_SECRET.", { status: 503 });

const isAgentDiscoveryRequest = (request: Request): boolean =>
  cloudflarePathname(request) === "/.well-known/agent-configuration";

const isAuthRequest = (request: Request): boolean => {
  const pathname = cloudflarePathname(request);
  return pathname === "/api/auth" || pathname.startsWith("/api/auth/");
};

const handleAuthRequest = async (request: Request, env: CloudflareWorkerEnv): Promise<Response> => {
  const runtime = readCloudflareRuntime(env);

  if (Option.isNone(runtime.config.betterAuthSecret)) {
    return betterAuthUnavailableResponse();
  }

  const deps = buildCloudflareAuthDependencies(runtime);
  await ensureAuthPersistence(deps);

  return createAuth({ ...deps, request }).handler(request);
};

export const cloudflareAgentDiscoveryMount: CloudflareMount<CloudflareWorkerEnv> = {
  name: "agent-discovery",
  matches: isAgentDiscoveryRequest,
  handle: async ({ env, request }) =>
    cloudflareResponse(
      await handleAuthRequest(rewriteRequestPath(request, "/api/auth/agent-configuration"), env),
    ),
};

export const cloudflareAuthMount: CloudflareMount<CloudflareWorkerEnv> = {
  name: "auth",
  matches: isAuthRequest,
  handle: async ({ env, request }) => cloudflareResponse(await handleAuthRequest(request, env)),
};

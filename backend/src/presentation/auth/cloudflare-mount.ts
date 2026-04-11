import type { OnionCloudflareWorkerEnv } from "#presentation/cloudflare/context";
import {
  cloudflarePathname,
  cloudflareResponse,
  rewriteRequestPath,
  type CloudflareMount,
} from "#presentation/cloudflare/mount";
import { createCloudflareAuth, ensureCloudflareAuthPersistence } from "#presentation/auth/server";

const betterAuthUnavailableResponse = () =>
  new Response("Better Auth is unavailable. Configure BETTER_AUTH_SECRET.", { status: 503 });

const hasBetterAuthSecret = (secret: string | undefined) => (secret?.trim() ?? "") !== "";

const isAgentDiscoveryRequest = (request: Request): boolean =>
  cloudflarePathname(request) === "/.well-known/agent-configuration";

const isAuthRequest = (request: Request): boolean => {
  const pathname = cloudflarePathname(request);
  return pathname === "/api/auth" || pathname.startsWith("/api/auth/");
};

const ensureAuthPersistence = async (env: OnionCloudflareWorkerEnv): Promise<void> =>
  ensureCloudflareAuthPersistence({
    db: env.DB,
    secret: env.BETTER_AUTH_SECRET,
  });

const handleAuthRequest = async (
  request: Request,
  env: OnionCloudflareWorkerEnv,
): Promise<Response> => {
  if (!hasBetterAuthSecret(env.BETTER_AUTH_SECRET)) {
    return betterAuthUnavailableResponse();
  }

  await ensureAuthPersistence(env);

  return createCloudflareAuth({
    db: env.DB,
    request,
    secret: env.BETTER_AUTH_SECRET,
  }).handler(request);
};

export const cloudflareAgentDiscoveryMount: CloudflareMount<OnionCloudflareWorkerEnv> = {
  name: "agent-discovery",
  matches: isAgentDiscoveryRequest,
  handle: async ({ env, request }) =>
    cloudflareResponse(
      await handleAuthRequest(rewriteRequestPath(request, "/api/auth/agent-configuration"), env),
    ),
};

export const cloudflareAuthMount: CloudflareMount<OnionCloudflareWorkerEnv> = {
  name: "auth",
  matches: isAuthRequest,
  handle: async ({ env, request }) => cloudflareResponse(await handleAuthRequest(request, env)),
};

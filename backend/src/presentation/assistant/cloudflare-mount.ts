import * as Option from "effect/Option";
import { getAssistantModel, handleAssistantRequest } from "#presentation/assistant/handler";
import type { AssistantAiConfig } from "#presentation/assistant/runtime";
import {
  readCloudflareRuntime,
  type CloudflareRuntime,
  type CloudflareWorkerEnv,
} from "#presentation/cloudflare/context";
import { rejectDirectHttpBearerRequest } from "#presentation/cloudflare/direct-http-auth";
import {
  cloudflarePathname,
  cloudflareResponse,
  rewriteRequestPath,
  type CloudflareMount,
} from "#presentation/cloudflare/mount";
import { actorLogFields } from "#presentation/observability/logging";
import { buildCloudflareAuthDependencies } from "#presentation/auth/cloudflare-mount";
import { ensureAuthPersistence, resolveActor } from "#presentation/auth/server";
import { makeCloudflareCoffeeAppLive } from "#runtime/cloudflare/live";

const isAssistantRequest = (request: Request): boolean => {
  const pathname = cloudflarePathname(request);
  return pathname === "/api/assistant" || pathname === "/api/assistant/";
};

const rewriteApiRequest = (request: Request): Request => {
  const pathname = cloudflarePathname(request);
  const rewrittenPathname = pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  return rewriteRequestPath(request, rewrittenPathname);
};

const getAssistantAiConfig = (runtime: CloudflareRuntime): AssistantAiConfig | undefined =>
  Option.match(runtime.bindings.ai, {
    onNone: () => undefined,
    onSome: (binding) =>
      Option.match(runtime.config.aiGatewayId, {
        onNone: () => ({ binding, kind: "binding" }),
        onSome: (gatewayId) => ({ binding, gatewayId, kind: "binding" }),
      }),
  });

export const cloudflareAssistantMount: CloudflareMount<CloudflareWorkerEnv> = {
  name: "assistant",
  matches: isAssistantRequest,
  handle: async ({ env, request }) =>
    Option.match(Option.fromNullishOr(rejectDirectHttpBearerRequest(request)), {
      onNone: async () => {
        const runtime = readCloudflareRuntime(env);
        const authDeps = buildCloudflareAuthDependencies(runtime);

        await ensureAuthPersistence(authDeps);

        const actor = await resolveActor({ ...authDeps, request });

        return cloudflareResponse(
          await handleAssistantRequest(rewriteApiRequest(request), {
            actor,
            ai: getAssistantAiConfig(runtime),
            appLayer: makeCloudflareCoffeeAppLive(runtime.bindings.db),
            model: getAssistantModel(),
          }),
          actorLogFields(actor),
        );
      },
      onSome: async (response: Response) => cloudflareResponse(response),
    }),
};

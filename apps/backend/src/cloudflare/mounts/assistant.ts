import * as Option from "effect/Option";
import {
  getAssistantModel,
  handleAssistantRequest,
} from "@effect-coffee-shop/coffee-assistant/handler";
import type { AssistantAiConfig } from "@effect-coffee-shop/coffee-assistant/runtime";
import { readCloudflareRuntime, type CloudflareRuntime, type CloudflareWorkerEnv } from "../env.ts";
import { rejectDirectHttpBearerRequest } from "../direct-http-auth.ts";
import {
  cloudflarePathname,
  cloudflareResponse,
  rewriteRequestPath,
  type CloudflareMount,
} from "@effect-coffee-shop/backend-host/mount";
import { actorLogFields } from "@effect-coffee-shop/backend-host/logging";
import {
  ensureCloudflareAuthPersistence,
  resolveCloudflareActor,
} from "@effect-coffee-shop/coffee-auth/better-auth";
import { makeCloudflareCoffeeAppLive } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";

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

        await ensureCloudflareAuthPersistence({
          db: runtime.bindings.db,
          secret: Option.getOrUndefined(runtime.config.betterAuthSecret),
        });

        const appLayer = makeCloudflareCoffeeAppLive(runtime.bindings.db);
        const actor = await resolveCloudflareActor({
          appLayer,
          db: runtime.bindings.db,
          request,
          secret: Option.getOrUndefined(runtime.config.betterAuthSecret),
          staffUserIds: runtime.config.staffUserIds,
        });

        return cloudflareResponse(
          await handleAssistantRequest(rewriteApiRequest(request), {
            actor,
            ai: getAssistantAiConfig(runtime),
            appLayer,
            model: getAssistantModel(),
          }),
          actorLogFields(actor),
        );
      },
      onSome: async (response: Response) => cloudflareResponse(response),
    }),
};

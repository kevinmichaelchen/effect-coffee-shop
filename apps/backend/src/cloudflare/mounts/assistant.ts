import * as Option from "effect/Option";
import {
  createAssistantModelRunnerLayer,
  getAssistantModel,
  handleAssistantRequest,
} from "@effect-coffee-shop/coffee-assistant/handler";
import type { AssistantAiConfig } from "@effect-coffee-shop/coffee-assistant/runtime";
import { type CloudflareRuntime, type CloudflareWorkerEnv } from "../env.ts";
import { rejectDirectHttpBearerRequest } from "../direct-http-auth.ts";
import {
  cloudflarePathname,
  cloudflareResponse,
  rewriteRequestPath,
  type CloudflareMount,
} from "@effect-coffee-shop/backend-host/mount";
import { actorLogFields } from "@effect-coffee-shop/backend-host/logging";
import { resolveCloudflareRequestActor } from "./request-actor.ts";

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
        onNone: () => ({ binding, kind: "workers-ai-binding" }),
        onSome: (gatewayId) => ({ binding, gatewayId, kind: "workers-ai-binding" }),
      }),
  });

export const cloudflareAssistantMount: CloudflareMount<CloudflareWorkerEnv> = {
  name: "assistant",
  matches: isAssistantRequest,
  handle: async ({ env, request }) =>
    Option.match(Option.fromNullishOr(rejectDirectHttpBearerRequest(request)), {
      onNone: async () => {
        const { actor, appLayer, runtime } = await resolveCloudflareRequestActor({ env, request });

        const ai = getAssistantAiConfig(runtime);
        const modelLayer = Option.match(Option.fromNullishOr(ai), {
          onNone: () => undefined,
          onSome: createAssistantModelRunnerLayer,
        });

        return cloudflareResponse(
          await handleAssistantRequest(rewriteApiRequest(request), {
            actor,
            appLayer,
            gatewayEnabled: Option.isSome(runtime.config.aiGatewayId),
            model: getAssistantModel(),
            modelLayer,
          }),
          actorLogFields(actor),
        );
      },
      onSome: async (response: Response) => cloudflareResponse(response),
    }),
};

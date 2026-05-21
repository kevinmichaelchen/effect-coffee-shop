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
  cloudflarePathEquals,
  cloudflareResponse,
  rewriteRequestPathPrefix,
  type CloudflareMount,
} from "@effect-coffee-shop/backend-host/mount";
import { actorLogFields } from "@effect-coffee-shop/backend-host/logging";
import { resolveCloudflareRequestActor } from "./request-actor.ts";

const isAssistantRequest = (request: Request): boolean =>
  cloudflarePathEquals(request, "/api/assistant") ||
  cloudflarePathEquals(request, "/api/assistant/");

const rewriteApiRequest = (request: Request): Request => rewriteRequestPathPrefix(request, "/api");

const getAssistantAiConfig = (runtime: CloudflareRuntime): Option.Option<AssistantAiConfig> =>
  Option.match(runtime.bindings.ai, {
    onNone: () => Option.none(),
    onSome: (binding) =>
      Option.match(runtime.config.aiGatewayId, {
        onNone: () => Option.some({ binding, kind: "workers-ai-binding" }),
        onSome: (gatewayId) => Option.some({ binding, gatewayId, kind: "workers-ai-binding" }),
      }),
  });

export const cloudflareAssistantMount: CloudflareMount<CloudflareWorkerEnv> = {
  name: "assistant",
  matches: isAssistantRequest,
  handle: async ({ env, request }) =>
    Option.match(rejectDirectHttpBearerRequest(request), {
      onNone: async () => {
        const { actor, backend, runtime } = await resolveCloudflareRequestActor({ env, request });

        const modelLayer = Option.match(getAssistantAiConfig(runtime), {
          onNone: () => undefined,
          onSome: createAssistantModelRunnerLayer,
        });

        return cloudflareResponse(
          await handleAssistantRequest(rewriteApiRequest(request), {
            actor,
            appLayer: backend.appLayer,
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

/**
 * Mounts the assistant HTTP route on the Cloudflare Worker.
 *
 * @module
 */
import * as Option from "effect/Option";
import { handleAssistantRequest } from "@effect-coffee-shop/coffee-assistant/handler";
import {
  createAssistantModelRunnerLayer,
  getAssistantModel,
  type AssistantAiConfig,
} from "@effect-coffee-shop/coffee-assistant/providers";
import { type CloudflareRuntime, type CloudflareWorkerEnv } from "../env.ts";
import { handleDirectHttpRequest } from "../../../host/direct-http-auth.ts";
import {
  requestPathEquals,
  fetchResponse,
  rewriteRequestPathPrefix,
  type FetchMount,
} from "@effect-coffee-shop/backend-host/mount";
import { actorObservabilityAttributes } from "@effect-coffee-shop/coffee-core/application/observability";
import { resolveCloudflareRequestActor } from "./request-actor.ts";

const isAssistantRequest = (request: Request): boolean =>
  requestPathEquals(request, "/api/assistant") || requestPathEquals(request, "/api/assistant/");

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

export const cloudflareAssistantMount: FetchMount<CloudflareWorkerEnv> = {
  name: "assistant",
  matches: isAssistantRequest,
  handle: async ({ env, request }) =>
    handleDirectHttpRequest(request, async () => {
      const { actor, backend, runtime } = await resolveCloudflareRequestActor({ env, request });

      const modelLayer = Option.match(getAssistantAiConfig(runtime), {
        onNone: () => undefined,
        onSome: createAssistantModelRunnerLayer,
      });

      return fetchResponse(
        await handleAssistantRequest(rewriteApiRequest(request), {
          actor,
          appLayer: backend.appLayer,
          gatewayEnabled: Option.isSome(runtime.config.aiGatewayId),
          model: getAssistantModel(),
          modelLayer,
        }),
        actorObservabilityAttributes(actor),
      );
    }),
};

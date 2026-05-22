/**
 * Mounts the assistant HTTP route on the Cloudflare Worker.
 *
 * @module
 */
import * as Option from "effect/Option";
import { handleAssistantRequest } from "@effect-coffee-shop/coffee-assistant/handler";
import {
  createAssistantModelRunnerLayer,
  createWorkersAiBindingConfig,
  getAssistantModelLabel,
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
      Option.fromNullishOr(
        createWorkersAiBindingConfig({
          binding,
          gatewayId: Option.getOrUndefined(runtime.config.aiGatewayId),
          model: Option.getOrUndefined(runtime.config.assistantModel),
        }),
      ),
  });

export const cloudflareAssistantMount: FetchMount<CloudflareWorkerEnv> = {
  name: "assistant",
  matches: isAssistantRequest,
  handle: async ({ env, request }) =>
    handleDirectHttpRequest(request, async () => {
      const { actor, backend, runtime } = await resolveCloudflareRequestActor({ env, request });
      const assistantAi = getAssistantAiConfig(runtime);

      const modelLayer = Option.match(assistantAi, {
        onNone: () => undefined,
        onSome: createAssistantModelRunnerLayer,
      });

      return fetchResponse(
        await handleAssistantRequest(rewriteApiRequest(request), {
          actor,
          appLayer: backend.appLayer,
          gatewayEnabled: Option.isSome(runtime.config.aiGatewayId),
          model: Option.getOrUndefined(Option.map(assistantAi, getAssistantModelLabel)),
          modelLayer,
        }),
        actorObservabilityAttributes(actor),
      );
    }),
};

/**
 * Mounts the assistant HTTP route on AWS Lambda.
 *
 * @module
 */
import * as Option from "effect/Option";
import {
  requestPathEquals,
  fetchResponse,
  rewriteRequestPathPrefix,
  type FetchMount,
} from "@effect-coffee-shop/backend-host/mount";
import { handleAssistantRequest } from "@effect-coffee-shop/coffee-assistant/handler";
import { createAssistantModelRunnerLayer } from "@effect-coffee-shop/coffee-assistant/providers";
import { actorObservabilityAttributes } from "@effect-coffee-shop/coffee-core/application/observability";
import type { AwsRuntime } from "../env.ts";
import { handleDirectHttpRequest } from "../../../host/direct-http-auth.ts";
import { resolveAwsRequestActor } from "./request-actor.ts";

const isAssistantRequest = (request: Request): boolean =>
  requestPathEquals(request, "/api/assistant") || requestPathEquals(request, "/api/assistant/");

const rewriteApiRequest = (request: Request): Request => rewriteRequestPathPrefix(request, "/api");

export const awsAssistantMount: FetchMount<AwsRuntime> = {
  name: "assistant",
  matches: isAssistantRequest,
  handle: async ({ env, request }) =>
    handleDirectHttpRequest(request, async () => {
      const { actor, backend, runtime } = await resolveAwsRequestActor({
        runtime: env,
        request,
      });

      const modelLayer = Option.match(runtime.config.assistantAi, {
        onNone: () => undefined,
        onSome: createAssistantModelRunnerLayer,
      });

      return fetchResponse(
        await handleAssistantRequest(rewriteApiRequest(request), {
          actor,
          appLayer: backend.appLayer,
          model: runtime.config.assistantModel,
          modelLayer,
        }),
        actorObservabilityAttributes(actor),
      );
    }),
};

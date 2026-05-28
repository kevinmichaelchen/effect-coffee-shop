/**
 * Routes the assistant HTTP route on AWS Lambda.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import {
  requestPathEquals,
  routeResponse,
  rewriteRequestPathPrefix,
  type HttpRoute,
} from "@effect-coffee-shop/http-routing/route";
import { handleAssistantRequest } from "@effect-coffee-shop/coffee-assistant/handler";
import {
  createAssistantModelRunnerLayer,
  getAssistantModelLabel,
} from "@effect-coffee-shop/coffee-assistant/providers";
import { actorObservabilityAttributes } from "@effect-coffee-shop/coffee-core/application/observability";
import type { AwsRuntime } from "../env.ts";
import { handleDirectHttpRequest } from "@effect-coffee-shop/coffee-backend/http/direct-auth";
import { resolveAwsRequestActor } from "./request-actor.ts";

const isAssistantRequest = (request: Request): boolean =>
  requestPathEquals(request, "/api/assistant") || requestPathEquals(request, "/api/assistant/");

const rewriteApiRequest = (request: Request): Request => rewriteRequestPathPrefix(request, "/api");

export const assistantRoute: HttpRoute<AwsRuntime> = {
  name: "assistant",
  matches: isAssistantRequest,
  handle: ({ env, request }) =>
    handleDirectHttpRequest(
      request,
      Effect.fn(function* () {
        const { actor, backend, runtime } = yield* resolveAwsRequestActor({
          runtime: env,
          request,
        });

        const modelLayer = Option.match(runtime.config.assistantAi, {
          onNone: () => undefined,
          onSome: createAssistantModelRunnerLayer,
        });

        return routeResponse(
          yield* Effect.promise(async () =>
            handleAssistantRequest(rewriteApiRequest(request), {
              actor,
              appLayer: backend.appLayer,
              model: Option.getOrUndefined(
                Option.map(runtime.config.assistantAi, getAssistantModelLabel),
              ),
              modelLayer,
            }),
          ),
          actorObservabilityAttributes(actor),
        );
      }),
    ),
};

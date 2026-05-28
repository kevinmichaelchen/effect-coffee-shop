/**
 * Routes the assistant HTTP route for the local Bun backend.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { handleAssistantRequest } from "@effect-coffee-shop/coffee-assistant/handler";
import {
  createAssistantModelRunnerLayer,
  getAssistantModelLabel,
  getBunAssistantAiConfig,
} from "@effect-coffee-shop/coffee-assistant/providers";
import { routeResponse, requestPathEquals } from "@effect-coffee-shop/http-routing/route";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import type { BunHttpRoute } from "./coffee-bun-server.ts";
import type { CoffeeAppLayer } from "@effect-coffee-shop/coffee-backend/http/backend";

const isAssistantRequest = (request: Request): boolean =>
  requestPathEquals(request, "/assistant") || requestPathEquals(request, "/assistant/");

export const makeAssistantRoute = (input: { readonly appLayer: CoffeeAppLayer }): BunHttpRoute => ({
  name: "assistant",
  matches: isAssistantRequest,
  handle: ({ env, request }) =>
    Effect.gen(function* () {
      const ai = getBunAssistantAiConfig(env);
      const assistantAi = Option.fromNullishOr(ai);
      const modelLayer = Option.match(assistantAi, {
        onNone: () => undefined,
        onSome: createAssistantModelRunnerLayer,
      });

      return routeResponse(
        yield* Effect.promise(async () =>
          handleAssistantRequest(request, {
            actor: systemActor,
            appLayer: input.appLayer,
            model: Option.getOrUndefined(Option.map(assistantAi, getAssistantModelLabel)),
            modelLayer,
          }),
        ),
      );
    }),
});

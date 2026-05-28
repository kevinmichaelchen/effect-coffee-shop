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
import { fetchResponse, requestPathEquals } from "@effect-coffee-shop/fetch-host/route";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import type { CoffeeBunRoute } from "./coffee-bun-server.ts";
import type { CoffeeAppLayer } from "../../http/coffee-backend.ts";

const isAssistantRequest = (request: Request): boolean =>
  requestPathEquals(request, "/assistant") || requestPathEquals(request, "/assistant/");

export const makeBunAssistantRoute = (input: {
  readonly appLayer: CoffeeAppLayer;
}): CoffeeBunRoute => ({
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

      return fetchResponse(
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

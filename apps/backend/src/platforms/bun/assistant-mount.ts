/**
 * Mounts the assistant HTTP route for the local Bun backend.
 *
 * @module
 */
import * as Option from "effect/Option";
import { handleAssistantRequest } from "@effect-coffee-shop/coffee-assistant/handler";
import {
  createAssistantModelRunnerLayer,
  getAssistantModelLabel,
  getBunAssistantAiConfig,
} from "@effect-coffee-shop/coffee-assistant/providers";
import { fetchResponse, requestPathEquals } from "@effect-coffee-shop/backend-host/mount";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import type { CoffeeBunMount } from "./coffee-bun-server.ts";
import type { CoffeeAppLayer } from "../../host/coffee-backend.ts";

const isAssistantRequest = (request: Request): boolean =>
  requestPathEquals(request, "/assistant") || requestPathEquals(request, "/assistant/");

export const makeBunAssistantMount = (input: {
  readonly appLayer: CoffeeAppLayer;
}): CoffeeBunMount => ({
  name: "assistant",
  matches: isAssistantRequest,
  handle: async ({ env, request }) => {
    const ai = getBunAssistantAiConfig(env);
    const assistantAi = Option.fromNullishOr(ai);
    const modelLayer = Option.match(assistantAi, {
      onNone: () => undefined,
      onSome: createAssistantModelRunnerLayer,
    });

    return fetchResponse(
      await handleAssistantRequest(request, {
        actor: systemActor,
        appLayer: input.appLayer,
        model: Option.getOrUndefined(Option.map(assistantAi, getAssistantModelLabel)),
        modelLayer,
      }),
    );
  },
});

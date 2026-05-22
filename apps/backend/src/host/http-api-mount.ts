/**
 * Builds the Coffee HTTP API mount for Fetch-based runtimes.
 *
 * @module
 */
import type * as Context from "effect/Context";
import {
  fetchResponse,
  requestPathIsOrStartsWith,
  rewriteRequestPathPrefix,
  type FetchMount,
} from "@effect-coffee-shop/backend-host/mount";
import type { AppActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { actorObservabilityAttributes } from "@effect-coffee-shop/coffee-core/application/observability";
import { handleDirectHttpRequest } from "./direct-http-auth.ts";
import type { CoffeeBackend } from "./coffee-backend.ts";

interface CoffeeHttpApiActorResolution {
  readonly actor: AppActor;
  readonly backend: CoffeeBackend<unknown>;
}

export interface CoffeeHttpApiMountOptions<TEnv> {
  readonly createRequestServices: (actor: AppActor) => Context.Context<unknown>;
  readonly resolveRequestActor: (input: {
    readonly env: TEnv;
    readonly request: Request;
  }) => Promise<CoffeeHttpApiActorResolution>;
}

const isApiRequest = (request: Request): boolean => requestPathIsOrStartsWith(request, "/api");

const rewriteApiRequest = (request: Request): Request => rewriteRequestPathPrefix(request, "/api");

export const makeCoffeeHttpApiMount = <TEnv>(
  options: CoffeeHttpApiMountOptions<TEnv>,
): FetchMount<TEnv> => ({
  name: "api",
  matches: isApiRequest,
  handle: async ({ env, request }) =>
    handleDirectHttpRequest(request, async () => {
      const { actor, backend } = await options.resolveRequestActor({ env, request });

      return fetchResponse(
        await backend.handler(rewriteApiRequest(request), options.createRequestServices(actor)),
        actorObservabilityAttributes(actor),
      );
    }),
});

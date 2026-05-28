/**
 * Builds the Coffee HTTP API route for Fetch-based runtimes.
 *
 * @module
 */
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import {
  fetchResponse,
  requestPathIsOrStartsWith,
  rewriteRequestPathPrefix,
  type FetchRoute,
} from "@effect-coffee-shop/fetch-host/route";
import type { AppActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { actorObservabilityAttributes } from "@effect-coffee-shop/coffee-core/application/observability";
import { handleDirectHttpRequest } from "./direct-http-auth.ts";
import type { CoffeeBackend } from "./coffee-backend.ts";

interface CoffeeHttpApiActorResolution {
  readonly actor: AppActor;
  readonly backend: CoffeeBackend<unknown>;
}

type CoffeeHttpApiActorResolutionEffect = ReturnType<
  typeof Effect.suspend<CoffeeHttpApiActorResolution, unknown, never>
>;

export interface CoffeeHttpApiRouteOptions<TEnv> {
  readonly createRequestServices: (actor: AppActor) => Context.Context<unknown>;
  readonly resolveRequestActor: (input: {
    readonly env: TEnv;
    readonly request: Request;
  }) => CoffeeHttpApiActorResolutionEffect;
}

const isApiRequest = (request: Request): boolean => requestPathIsOrStartsWith(request, "/api");

const rewriteApiRequest = (request: Request): Request => rewriteRequestPathPrefix(request, "/api");

export const makeCoffeeHttpApiRoute = <TEnv>(
  options: CoffeeHttpApiRouteOptions<TEnv>,
): FetchRoute<TEnv> => ({
  name: "api",
  matches: isApiRequest,
  handle: ({ env, request }) =>
    handleDirectHttpRequest(
      request,
      Effect.fn(function* () {
        const { actor, backend } = yield* options.resolveRequestActor({ env, request });

        return fetchResponse(
          yield* Effect.promise(async () =>
            backend.handler(rewriteApiRequest(request), options.createRequestServices(actor)),
          ),
          actorObservabilityAttributes(actor),
        );
      }),
    ),
});

/**
 * Builds the Coffee HTTP API route for Web Request/Response HTTP runtimes.
 *
 * @module
 */
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import {
  routeResponse,
  requestPathIsOrStartsWith,
  rewriteRequestPathPrefix,
  type HttpRoute,
} from "@effect-coffee-shop/http-routing/route";
import type { AppActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { actorObservabilityAttributes } from "@effect-coffee-shop/coffee-core/application/observability";
import { handleDirectHttpRequest } from "./direct-auth.ts";
import type { CoffeeBackend } from "./backend.ts";

interface CoffeeApiActorResolution {
  readonly actor: AppActor;
  readonly backend: CoffeeBackend<unknown>;
}

type CoffeeApiActorResolutionEffect = ReturnType<
  typeof Effect.suspend<CoffeeApiActorResolution, unknown, never>
>;

export interface CoffeeApiRouteOptions<TEnv> {
  readonly createRequestServices: (actor: AppActor) => Context.Context<unknown>;
  readonly resolveRequestActor: (input: {
    readonly env: TEnv;
    readonly request: Request;
  }) => CoffeeApiActorResolutionEffect;
}

const isApiRequest = (request: Request): boolean => requestPathIsOrStartsWith(request, "/api");

const rewriteApiRequest = (request: Request): Request => rewriteRequestPathPrefix(request, "/api");

export const makeCoffeeApiRoute = <TEnv>(
  options: CoffeeApiRouteOptions<TEnv>,
): HttpRoute<TEnv> => ({
  name: "api",
  matches: isApiRequest,
  handle: ({ env, request }) =>
    handleDirectHttpRequest(
      request,
      Effect.fn(function* () {
        const { actor, backend } = yield* options.resolveRequestActor({ env, request });

        return routeResponse(
          yield* Effect.promise(async () =>
            backend.handler(rewriteApiRequest(request), options.createRequestServices(actor)),
          ),
          actorObservabilityAttributes(actor),
        );
      }),
    ),
});

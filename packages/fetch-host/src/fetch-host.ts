import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { logRequestCompleted, logRequestFailed } from "./logging.ts";
import type {
  FetchRoute,
  FetchRouteResult,
  FetchRequestContext,
  HostRuntimeContext,
} from "./route.ts";
import {
  recordFetchHostRequestCompleted,
  recordFetchHostRequestFailed,
  requestSpanAttributes,
} from "./observability.ts";

const notFoundResponse = () => new Response("Not Found", { status: 404 });

const createRequestContext = <TEnv>(
  request: Request,
  env: TEnv,
  runtime: HostRuntimeContext,
): FetchRequestContext<TEnv> => ({
  env,
  request,
  runtime,
});

const findMatchingRoute = <TEnv>(
  routes: ReadonlyArray<FetchRoute<TEnv>>,
  request: Request,
): FetchRoute<TEnv> | undefined => routes.find((route) => route.matches(request));

export const createFetchHost =
  <TEnv>(routes: ReadonlyArray<FetchRoute<TEnv>>) =>
  (request: Request, env: TEnv, runtime: HostRuntimeContext = {}) => {
    const route = findMatchingRoute(routes, request);
    const routeKind = route?.name ?? "unmatched";
    const startedAt = performance.now();

    return Effect.gen(function* () {
      const { logFields, response } = yield* Option.match(Option.fromUndefinedOr(route), {
        onNone: () => {
          const result: FetchRouteResult = { response: notFoundResponse() };
          return Effect.succeed(result);
        },
        onSome: (matchingRoute) =>
          matchingRoute.handle(createRequestContext(request, env, runtime)),
      }).pipe(Effect.mapError((error: unknown) => error));
      const durationMs = performance.now() - startedAt;

      yield* recordFetchHostRequestCompleted({
        durationMs,
        method: request.method,
        routeKind,
        status: response.status,
      });

      yield* Option.match(Option.fromUndefinedOr(logFields), {
        onNone: () =>
          logRequestCompleted({
            durationMs,
            request,
            response,
            routeKind,
          }),
        onSome: (extraFields) =>
          logRequestCompleted({
            durationMs,
            extraFields,
            request,
            response,
            routeKind,
          }),
      });

      return response;
    }).pipe(
      Effect.mapError((error: unknown) => error),
      Effect.tapError((error: unknown) => {
        const durationMs = performance.now() - startedAt;

        return recordFetchHostRequestFailed({
          durationMs,
          method: request.method,
          routeKind,
        }).pipe(
          Effect.andThen(
            logRequestFailed({
              durationMs,
              error,
              request,
              routeKind,
            }),
          ),
        );
      }),
      Effect.withSpan("fetch_host.request"),
      Effect.annotateSpans(requestSpanAttributes({ request, routeKind })),
    );
  };

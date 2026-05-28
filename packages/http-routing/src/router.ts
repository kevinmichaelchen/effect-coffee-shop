import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { logRequestCompleted, logRequestFailed } from "./logging.ts";
import type {
  HttpRoute,
  HttpRouteResult,
  HttpRequestContext,
  HttpRuntimeContext,
} from "./route.ts";
import {
  recordHttpRequestCompleted,
  recordHttpRequestFailed,
  requestSpanAttributes,
} from "./observability.ts";

const notFoundResponse = () => new Response("Not Found", { status: 404 });

const createRequestContext = <TEnv>(
  request: Request,
  env: TEnv,
  runtime: HttpRuntimeContext,
): HttpRequestContext<TEnv> => ({
  env,
  request,
  runtime,
});

const findMatchingRoute = <TEnv>(
  routes: ReadonlyArray<HttpRoute<TEnv>>,
  request: Request,
): HttpRoute<TEnv> | undefined => routes.find((route) => route.matches(request));

export const createHttpRouter =
  <TEnv>(routes: ReadonlyArray<HttpRoute<TEnv>>) =>
  (request: Request, env: TEnv, runtime: HttpRuntimeContext = {}) => {
    const route = findMatchingRoute(routes, request);
    const routeKind = route?.name ?? "unmatched";
    const startedAt = performance.now();

    return Effect.gen(function* () {
      const { logFields, response } = yield* Option.match(Option.fromUndefinedOr(route), {
        onNone: () => {
          const result: HttpRouteResult = { response: notFoundResponse() };
          return Effect.succeed(result);
        },
        onSome: (matchingRoute) =>
          matchingRoute.handle(createRequestContext(request, env, runtime)),
      });
      const durationMs = performance.now() - startedAt;

      yield* recordHttpRequestCompleted({
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
      Effect.tapError((error: unknown) => {
        const durationMs = performance.now() - startedAt;

        return recordHttpRequestFailed({
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
      Effect.withSpan("http_routing.request"),
      Effect.annotateSpans(requestSpanAttributes({ request, routeKind })),
    );
  };

import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { WideEvent } from "effect-wide-event";
import { annotateHttpResponse, withHttpWideEvent } from "./logging.ts";
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
): Option.Option<HttpRoute<TEnv>> => Arr.findFirst(routes, (route) => route.matches(request));

export const createHttpRouter =
  <TEnv>(routes: ReadonlyArray<HttpRoute<TEnv>>) =>
  (request: Request, env: TEnv, runtime: HttpRuntimeContext = {}) =>
    Effect.gen(function* () {
      const route = findMatchingRoute(routes, request);
      const routeKind = Option.match(route, {
        onNone: () => "unmatched",
        onSome: (route) => route.name,
      });
      const startedAt = performance.now();
      yield* WideEvent.set({ route_kind: routeKind });

      return yield* Option.match(route, {
        onNone: () => {
          const result: HttpRouteResult = { response: notFoundResponse() };
          return Effect.succeed(result);
        },
        onSome: (matchingRoute) =>
          Effect.suspend(() => matchingRoute.handle(createRequestContext(request, env, runtime))),
      }).pipe(
        Effect.tap(({ logFields, response }) =>
          annotateHttpResponse({ extraFields: logFields ?? {}, response, routeKind }),
        ),
        Effect.map(({ response }) => response),
        Effect.onExit((exit) => {
          const durationMs = performance.now() - startedAt;
          return Exit.isSuccess(exit)
            ? recordHttpRequestCompleted({
                durationMs,
                method: request.method,
                routeKind,
                status: exit.value.status,
              })
            : recordHttpRequestFailed({ durationMs, method: request.method, routeKind });
        }),
        Effect.withSpan("http_routing.request"),
        Effect.annotateSpans(requestSpanAttributes({ request, routeKind })),
      );
    }).pipe(withHttpWideEvent(request));

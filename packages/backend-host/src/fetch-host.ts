import * as Effect from "effect/Effect";
import { logRequestCompleted, logRequestFailed } from "./logging.ts";
import type { FetchMount, FetchRequestContext, HostRuntimeContext } from "./mount.ts";
import {
  recordFetchHostRequestCompleted,
  recordFetchHostRequestFailed,
  requestSpanAttributes,
  runHostEffect,
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

const findMatchingMount = <TEnv>(
  mounts: ReadonlyArray<FetchMount<TEnv>>,
  request: Request,
): FetchMount<TEnv> | undefined => mounts.find((mount) => mount.matches(request));

export const createFetchHost =
  <TEnv>(mounts: ReadonlyArray<FetchMount<TEnv>>) =>
  async (request: Request, env: TEnv, runtime: HostRuntimeContext = {}): Promise<Response> => {
    const mount = findMatchingMount(mounts, request);
    const routeKind = mount?.name ?? "unmatched";
    const startedAt = performance.now();

    try {
      if (mount === undefined) {
        const response = notFoundResponse();
        const durationMs = performance.now() - startedAt;

        await runHostEffect(
          Effect.gen(function* () {
            yield* recordFetchHostRequestCompleted({
              durationMs,
              method: request.method,
              routeKind,
              status: response.status,
            });
            yield* logRequestCompleted({
              durationMs,
              request,
              response,
              routeKind,
            });
          }).pipe(
            Effect.withSpan("fetch_host.request"),
            Effect.annotateSpans(requestSpanAttributes({ request, routeKind })),
          ),
        );

        return response;
      }

      return await runHostEffect(
        Effect.gen(function* () {
          const { logFields, response } = yield* Effect.promise(() =>
            mount.handle(createRequestContext(request, env, runtime)),
          );
          const durationMs = performance.now() - startedAt;

          yield* recordFetchHostRequestCompleted({
            durationMs,
            method: request.method,
            routeKind,
            status: response.status,
          });

          if (logFields === undefined) {
            yield* logRequestCompleted({
              durationMs,
              request,
              response,
              routeKind,
            });
          } else {
            yield* logRequestCompleted({
              durationMs,
              extraFields: logFields,
              request,
              response,
              routeKind,
            });
          }

          return response;
        }).pipe(
          Effect.withSpan("fetch_host.request"),
          Effect.annotateSpans(requestSpanAttributes({ request, routeKind })),
        ),
      );
    } catch (error) {
      const durationMs = performance.now() - startedAt;

      await runHostEffect(
        Effect.gen(function* () {
          yield* recordFetchHostRequestFailed({
            durationMs,
            method: request.method,
            routeKind,
          });
          yield* logRequestFailed({
            durationMs,
            error,
            request,
            routeKind,
          });
        }).pipe(
          Effect.withSpan("fetch_host.request"),
          Effect.annotateSpans(requestSpanAttributes({ request, routeKind })),
        ),
      );

      throw error;
    }
  };

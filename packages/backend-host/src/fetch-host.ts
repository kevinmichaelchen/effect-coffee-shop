import type { ExecutionContext } from "@cloudflare/workers-types";
import * as Effect from "effect/Effect";
import { logRequestCompleted, logRequestFailed } from "./logging.ts";
import type { CloudflareMount, CloudflareRequestContext } from "./mount.ts";
import {
  recordWorkerRequestCompleted,
  recordWorkerRequestFailed,
  requestSpanAttributes,
  runHostEffect,
} from "./observability.ts";

const notFoundResponse = () => new Response("Not Found", { status: 404 });

const createRequestContext = <TEnv>(
  request: Request,
  env: TEnv,
  executionContext: ExecutionContext,
): CloudflareRequestContext<TEnv> => ({
  env,
  executionContext,
  request,
});

const findMatchingMount = <TEnv>(
  mounts: ReadonlyArray<CloudflareMount<TEnv>>,
  request: Request,
): CloudflareMount<TEnv> | undefined => mounts.find((mount) => mount.matches(request));

export const createCloudflareHost =
  <TEnv>(mounts: ReadonlyArray<CloudflareMount<TEnv>>) =>
  async (request: Request, env: TEnv, executionContext: ExecutionContext): Promise<Response> => {
    const mount = findMatchingMount(mounts, request);
    const routeKind = mount?.name ?? "unmatched";
    const startedAt = performance.now();

    try {
      if (mount === undefined) {
        const response = notFoundResponse();
        const durationMs = performance.now() - startedAt;

        await runHostEffect(
          Effect.gen(function* () {
            yield* recordWorkerRequestCompleted({
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
            Effect.withSpan("worker.request"),
            Effect.annotateSpans(requestSpanAttributes({ request, routeKind })),
          ),
        );

        return response;
      }

      return await runHostEffect(
        Effect.gen(function* () {
          const { logFields, response } = yield* Effect.promise(() =>
            mount.handle(createRequestContext(request, env, executionContext)),
          );
          const durationMs = performance.now() - startedAt;

          yield* recordWorkerRequestCompleted({
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
          Effect.withSpan("worker.request"),
          Effect.annotateSpans(requestSpanAttributes({ request, routeKind })),
        ),
      );
    } catch (error) {
      const durationMs = performance.now() - startedAt;

      await runHostEffect(
        Effect.gen(function* () {
          yield* recordWorkerRequestFailed({
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
          Effect.withSpan("worker.request"),
          Effect.annotateSpans(requestSpanAttributes({ request, routeKind })),
        ),
      );

      throw error;
    }
  };

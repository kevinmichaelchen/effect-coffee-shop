import type { ExecutionContext } from "@cloudflare/workers-types";
import { logRequestCompleted, logRequestFailed } from "./logging.ts";
import type { CloudflareMount, CloudflareRequestContext } from "./mount.ts";

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
        logRequestCompleted({
          durationMs: performance.now() - startedAt,
          request,
          response,
          routeKind,
        });
        return response;
      }

      const { logFields, response } = await mount.handle(
        createRequestContext(request, env, executionContext),
      );

      if (logFields === undefined) {
        logRequestCompleted({
          durationMs: performance.now() - startedAt,
          request,
          response,
          routeKind,
        });
      } else {
        logRequestCompleted({
          durationMs: performance.now() - startedAt,
          extraFields: logFields,
          request,
          response,
          routeKind,
        });
      }

      return response;
    } catch (error) {
      logRequestFailed({
        durationMs: performance.now() - startedAt,
        error,
        request,
        routeKind,
      });
      throw error;
    }
  };

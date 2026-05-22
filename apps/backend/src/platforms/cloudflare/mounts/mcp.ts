/**
 * Mounts the Coffee MCP HTTP route on the Cloudflare Worker.
 *
 * @module
 */
import { readCloudflareRuntime, type CloudflareWorkerEnv } from "../env.ts";
import {
  requestPathIsOrStartsWith,
  fetchResponse,
  type FetchMount,
} from "@effect-coffee-shop/backend-host/mount";
import { createCloudflareRequestServices, getCloudflareRuntimeBackend } from "../coffee-backend.ts";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";

const isMcpRequest = (request: Request): boolean => requestPathIsOrStartsWith(request, "/mcp");

export const cloudflareMcpMount: FetchMount<CloudflareWorkerEnv> = {
  name: "mcp",
  matches: isMcpRequest,
  handle: async ({ env, request }) => {
    const runtime = readCloudflareRuntime(env);
    const backend = getCloudflareRuntimeBackend(runtime);

    await backend.ensureAuthPersistence();

    return fetchResponse(
      await backend.handler(request, createCloudflareRequestServices(systemActor)),
    );
  },
};

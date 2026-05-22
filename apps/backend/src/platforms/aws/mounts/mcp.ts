/**
 * Mounts the Coffee MCP HTTP route on AWS Lambda.
 *
 * @module
 */
import {
  requestPathIsOrStartsWith,
  fetchResponse,
  type FetchMount,
} from "@effect-coffee-shop/backend-host/mount";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { createAwsRequestServices, getAwsRuntimeBackend } from "../coffee-backend.ts";
import type { AwsRuntime } from "../env.ts";

const isMcpRequest = (request: Request): boolean => requestPathIsOrStartsWith(request, "/mcp");

export const awsMcpMount: FetchMount<AwsRuntime> = {
  name: "mcp",
  matches: isMcpRequest,
  handle: async ({ request }) => {
    const backend = getAwsRuntimeBackend();

    await backend.ensureAuthPersistence();

    return fetchResponse(await backend.handler(request, createAwsRequestServices(systemActor)));
  },
};

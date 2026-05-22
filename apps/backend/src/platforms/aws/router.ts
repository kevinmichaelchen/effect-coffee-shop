/**
 * Routes AWS Lambda Function URL requests across auth, assistant, API, and MCP mounts.
 *
 * @module
 */
import { createFetchHost } from "@effect-coffee-shop/backend-host/fetch-host";
import { awsAssistantMount } from "./mounts/assistant.ts";
import { awsAgentDiscoveryMount, awsAuthMount } from "./mounts/auth.ts";
import { awsHttpApiMount } from "./mounts/http-api.ts";
import { awsMcpMount } from "./mounts/mcp.ts";
import { readAwsRuntime } from "./env.ts";

const routeRequest = createFetchHost([
  awsAgentDiscoveryMount,
  awsAuthMount,
  awsAssistantMount,
  awsHttpApiMount,
  awsMcpMount,
]);

export const routeAwsRequest = async (request: Request, env: unknown): Promise<Response> =>
  routeRequest(request, readAwsRuntime(env));

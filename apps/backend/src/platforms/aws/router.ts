/**
 * Routes AWS Lambda Function URL requests across auth, assistant, API, and MCP routes.
 *
 * @module
 */
import { createFetchHost } from "@effect-coffee-shop/fetch-host/fetch-host";
import { awsAssistantRoute } from "./routes/assistant.ts";
import { awsAgentDiscoveryRoute, awsAuthRoute } from "./routes/auth.ts";
import { awsHttpApiRoute } from "./routes/http-api.ts";
import { awsMcpRoute } from "./routes/mcp.ts";
import { readAwsRuntime } from "./env.ts";

const routeRequest = createFetchHost([
  awsAgentDiscoveryRoute,
  awsAuthRoute,
  awsAssistantRoute,
  awsHttpApiRoute,
  awsMcpRoute,
]);

export const routeAwsRequest = (request: Request, env: unknown) =>
  routeRequest(request, readAwsRuntime(env));

/**
 * Routes AWS Lambda Function URL requests across auth, assistant, API, and MCP routes.
 *
 * @module
 */
import { createHttpRouter } from "@effect-coffee-shop/http-routing/router";
import { assistantRoute } from "./routes/assistant.ts";
import { agentDiscoveryRoute, authRoute } from "./routes/auth.ts";
import { httpApiRoute } from "./routes/http-api.ts";
import { mcpRoute } from "./routes/mcp.ts";
import { readAwsRuntime } from "./env.ts";

const handleHttpRequest = createHttpRouter([
  agentDiscoveryRoute,
  authRoute,
  assistantRoute,
  httpApiRoute,
  mcpRoute,
]);

// oxlint-disable-next-line effect/no-unknown-parameters -- AWS environment boundary forwards unknown input to the Config decoder.
export const routeAwsRequest = (request: Request, env: unknown) =>
  handleHttpRequest(request, readAwsRuntime(env));

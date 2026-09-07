/**
 * Routes AWS Lambda Function URL requests across auth, API, and MCP routes.
 *
 * @module
 */
import { createHttpRouter } from "@effect-coffee-shop/http-routing/router";
import { authRoute } from "./routes/auth.ts";
import { httpApiRoute } from "./routes/http-api.ts";
import { mcpRoute } from "./routes/mcp.ts";
import { readAwsRuntime } from "./env.ts";

const handleHttpRequest = createHttpRouter([authRoute, httpApiRoute, mcpRoute]);

// oxlint-disable-next-line effect/no-unknown-parameters -- AWS environment boundary forwards unknown input to the Config decoder.
export const routeAwsRequest = (request: Request, env: unknown) =>
  handleHttpRequest(request, readAwsRuntime(env));

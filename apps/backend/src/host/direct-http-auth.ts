/**
 * Rejects direct HTTP requests that try to use agent bearer tokens.
 *
 * @module
 */
import * as Option from "effect/Option";
import { fetchResponse, type FetchMountResult } from "@effect-coffee-shop/backend-host/mount";

const hasBearerAuthorization = (request: Request): boolean => {
  const authorization = request.headers.get("authorization");

  if (authorization === null) {
    return false;
  }

  return authorization.trimStart().toLowerCase().startsWith("bearer ");
};

const rejectDirectHttpBearerRequest = (request: Request): Option.Option<Response> => {
  if (!hasBearerAuthorization(request)) {
    return Option.none();
  }

  return Option.some(
    Response.json(
      {
        error:
          "Direct HTTP routes do not accept bearer agent tokens. Use session cookies for the app UI/API or MCP capability execution for agent access.",
      },
      {
        status: 400,
      },
    ),
  );
};

export const handleDirectHttpRequest = async (
  request: Request,
  handleAcceptedRequest: () => Promise<FetchMountResult>,
): Promise<FetchMountResult> =>
  await Option.match(rejectDirectHttpBearerRequest(request), {
    onNone: handleAcceptedRequest,
    onSome: async (response) => fetchResponse(response),
  });

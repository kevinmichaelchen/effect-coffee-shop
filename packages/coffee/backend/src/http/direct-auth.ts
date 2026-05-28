/**
 * Rejects direct HTTP requests that try to use agent bearer tokens.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { routeResponse, type HttpRouteEffect } from "@effect-coffee-shop/http-routing/route";

const hasBearerAuthorization = (request: Request): boolean => {
  return Option.fromNullishOr(request.headers.get("authorization")).pipe(
    Option.exists((authorization) => authorization.trimStart().toLowerCase().startsWith("bearer ")),
  );
};

const directHttpBearerRejection = () =>
  Response.json(
    {
      error:
        "Direct HTTP routes do not accept bearer agent tokens. Use session cookies for the app UI/API or MCP capability execution for agent access.",
    },
    {
      status: 400,
    },
  );

const rejectDirectHttpBearerRequest = (request: Request): Option.Option<Response> =>
  Option.some(request).pipe(
    Option.filter(hasBearerAuthorization),
    Option.map(() => directHttpBearerRejection()),
  );

export const handleDirectHttpRequest = (
  request: Request,
  handleAcceptedRequest: () => HttpRouteEffect,
): HttpRouteEffect =>
  Option.match(rejectDirectHttpBearerRequest(request), {
    onNone: handleAcceptedRequest,
    onSome: (response) => Effect.succeed(routeResponse(response)),
  });

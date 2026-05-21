import * as Option from "effect/Option";

const hasBearerAuthorization = (request: Request): boolean => {
  const authorization = request.headers.get("authorization");

  if (authorization === null) {
    return false;
  }

  return authorization.trimStart().toLowerCase().startsWith("bearer ");
};

export const rejectDirectHttpBearerRequest = (request: Request): Option.Option<Response> => {
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

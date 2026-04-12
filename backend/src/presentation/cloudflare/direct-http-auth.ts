const hasBearerAuthorization = (request: Request): boolean => {
  const authorization = request.headers.get("authorization");

  if (authorization === null) {
    return false;
  }

  return authorization.trimStart().toLowerCase().startsWith("bearer ");
};

export const rejectDirectHttpBearerRequest = (request: Request): Response | undefined => {
  if (!hasBearerAuthorization(request)) {
    return undefined;
  }

  return Response.json(
    {
      error:
        "Direct HTTP routes do not accept bearer agent tokens. Use session cookies for the app UI/API or MCP capability execution for agent access.",
    },
    {
      status: 400,
    },
  );
};

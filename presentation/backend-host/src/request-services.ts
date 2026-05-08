import * as Context from "effect/Context";

const UnusedWebHandlerService = Context.Service<unknown>(
  "presentation/backend-host/UnusedWebHandlerService",
);

export const emptyWebHandlerServices = (): Context.Context<unknown> =>
  Context.make(UnusedWebHandlerService, undefined);

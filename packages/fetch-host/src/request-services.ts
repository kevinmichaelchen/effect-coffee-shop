import * as Context from "effect/Context";

const UnusedWebHandlerService = Context.Service<unknown>(
  "packages/fetch-host/UnusedWebHandlerService",
);

export const emptyWebHandlerServices = (): Context.Context<unknown> =>
  Context.make(UnusedWebHandlerService, undefined);

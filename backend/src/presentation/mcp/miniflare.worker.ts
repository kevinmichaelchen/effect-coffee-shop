import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { InMemoryCoffeeAppLive } from "#external/live";
import { CoffeeMcpHttpLive } from "./server.ts";

const { handler } = HttpRouter.toWebHandler(
  CoffeeMcpHttpLive.pipe(Layer.provide(InMemoryCoffeeAppLive)),
  {
    disableLogger: true,
  },
);

export default {
  fetch: handler,
};

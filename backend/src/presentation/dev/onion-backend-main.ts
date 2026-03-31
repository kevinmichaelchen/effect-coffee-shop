import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { InMemoryCoffeeAppLive } from "#external/live";
import { CoffeeHttpApiLive } from "#presentation/http/api";
import { CoffeeMcpHttpLive } from "#presentation/mcp/server";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";

const OnionDevBackendLive = Layer.unwrap(
  Effect.gen(function* () {
    const port = yield* Config.number("PORT").pipe(Config.withDefault(3000));

    return HttpRouter.serve(Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive)).pipe(
      Layer.provide(CoffeeOrderApp.layer),
      Layer.provide(InMemoryCoffeeAppLive),
      Layer.provideMerge(BunHttpServer.layer({ port })),
    );
  }),
);

Layer.launch(OnionDevBackendLive).pipe(BunRuntime.runMain);

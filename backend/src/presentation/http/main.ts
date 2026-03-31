import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { BunCoffeeAppLive } from "#runtime/bun/live";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";
import { CoffeeHttpApiLive } from "./api.ts";

const HttpLive = Layer.unwrap(
  Effect.gen(function* () {
    const port = yield* Config.number("COFFEE_HTTP_PORT").pipe(Config.withDefault(3000));
    return HttpRouter.serve(CoffeeHttpApiLive).pipe(
      Layer.provide(CoffeeOrderApp.layer),
      Layer.provide(BunCoffeeAppLive),
      Layer.provideMerge(BunHttpServer.layer({ port })),
    );
  }),
);

Layer.launch(HttpLive).pipe(BunRuntime.runMain);

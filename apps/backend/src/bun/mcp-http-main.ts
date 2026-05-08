import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { CoffeeAppLive } from "#app-layer";
import { CurrentActor, systemActor } from "@effect-coffee-shop/coffee-core/service/CurrentActor";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";

const CoffeeMcpHttpServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const port = yield* Config.number("COFFEE_MCP_HTTP_PORT").pipe(Config.withDefault(3001));
    return HttpRouter.serve(CoffeeMcpHttpLive).pipe(
      Layer.provide(Layer.succeed(CurrentActor)(systemActor)),
      Layer.provide(CoffeeAppLive),
      Layer.provideMerge(BunHttpServer.layer({ port })),
    );
  }),
);

Layer.launch(CoffeeMcpHttpServerLive).pipe(BunRuntime.runMain);

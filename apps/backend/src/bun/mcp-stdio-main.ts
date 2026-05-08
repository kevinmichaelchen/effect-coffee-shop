import * as BunServices from "@effect/platform-bun/BunServices";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Layer from "effect/Layer";
import { CoffeeAppLive } from "#app-layer";
import { CurrentActor, systemActor } from "@effect-coffee-shop/coffee-core/service/CurrentActor";
import { CoffeeMcpStdioLive } from "@effect-coffee-shop/coffee-mcp/server";

Layer.launch(
  CoffeeMcpStdioLive.pipe(
    Layer.provide(Layer.succeed(CurrentActor)(systemActor)),
    Layer.provide(CoffeeAppLive),
    Layer.provide(BunServices.layer),
  ),
).pipe(BunRuntime.runMain);

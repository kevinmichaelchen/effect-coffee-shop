import * as BunServices from "@effect/platform-bun/BunServices";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Layer from "effect/Layer";
import { BunCoffeeAppLive } from "#runtime/bun/live";
import { CurrentActor, systemActor } from "#service/CurrentActor";
import { CoffeeMcpStdioLive } from "./server.ts";

Layer.launch(
  CoffeeMcpStdioLive.pipe(
    Layer.provide(Layer.succeed(CurrentActor)(systemActor)),
    Layer.provide(BunCoffeeAppLive),
    Layer.provide(BunServices.layer),
  ),
).pipe(BunRuntime.runMain);

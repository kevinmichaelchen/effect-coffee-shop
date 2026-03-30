import * as BunServices from "@effect/platform-bun/BunServices";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Layer from "effect/Layer";
import { BunCoffeeAppLive } from "#runtime/bun/live";
import { CoffeeMcpClassicStdioLive } from "./server.ts";

Layer.launch(
  CoffeeMcpClassicStdioLive.pipe(Layer.provide(BunCoffeeAppLive), Layer.provide(BunServices.layer)),
).pipe(BunRuntime.runMain);

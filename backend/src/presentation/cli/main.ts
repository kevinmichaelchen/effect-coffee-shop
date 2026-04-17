import * as BunServices from "@effect/platform-bun/BunServices";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { BunCoffeeAppLive } from "#runtime/bun/live";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";
import { CurrentActor, systemActor } from "#service/CurrentActor";
import { runCoffeeCli } from "./command.ts";

const CoffeeCliLive = Layer.mergeAll(
  Layer.succeed(CurrentActor)(systemActor),
  BunServices.layer,
  CoffeeOrderApp.layer.pipe(Layer.provide(BunCoffeeAppLive)),
);

runCoffeeCli.pipe(Effect.provide(CoffeeCliLive), BunRuntime.runMain);

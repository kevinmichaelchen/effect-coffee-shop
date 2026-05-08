import * as BunServices from "@effect/platform-bun/BunServices";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { CoffeeAppLive } from "#app-layer";
import { runCoffeeCli } from "@effect-coffee-shop/coffee-cli/command";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/service/CoffeeOrderApp";
import { CurrentActor, systemActor } from "@effect-coffee-shop/coffee-core/service/CurrentActor";

const CoffeeCliLive = Layer.mergeAll(
  Layer.succeed(CurrentActor)(systemActor),
  BunServices.layer,
  CoffeeOrderApp.layer.pipe(Layer.provide(CoffeeAppLive)),
);

runCoffeeCli.pipe(Effect.provide(CoffeeCliLive), BunRuntime.runMain);

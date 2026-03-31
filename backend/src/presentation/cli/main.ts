import * as BunServices from "@effect/platform-bun/BunServices";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Effect from "effect/Effect";
import { BunCoffeeAppLive } from "#runtime/bun/live";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";
import { runCoffeeCli } from "./command.ts";

runCoffeeCli.pipe(
  Effect.provide(CoffeeOrderApp.layer),
  Effect.provide(BunCoffeeAppLive),
  Effect.provide(BunServices.layer),
  BunRuntime.runMain,
);

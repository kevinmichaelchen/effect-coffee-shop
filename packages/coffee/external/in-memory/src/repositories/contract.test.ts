import * as Effect from "effect/Effect";
import { defineRepositoryContract } from "@effect-coffee-shop/coffee-core/application/testing/repository-contract";
import { InMemoryCoffeeRepositoriesLive } from "../index.ts";

defineRepositoryContract("in-memory repositories", (effect) =>
  Effect.runPromise(effect.pipe(Effect.provide(InMemoryCoffeeRepositoriesLive))),
);

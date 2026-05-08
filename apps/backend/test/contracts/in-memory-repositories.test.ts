import * as Effect from "effect/Effect";
import { InMemoryCoffeeRepositoriesLive } from "@effect-coffee-shop/coffee-external-in-memory";
import { defineRepositoryContract } from "./repository-contract.ts";

defineRepositoryContract("in-memory repositories", (effect) =>
  Effect.runPromise(effect.pipe(Effect.provide(InMemoryCoffeeRepositoriesLive))),
);

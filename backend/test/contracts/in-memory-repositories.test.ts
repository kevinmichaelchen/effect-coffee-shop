import * as Effect from "effect/Effect";
import { InMemoryCoffeeRepositoriesLive } from "#external/live";
import { defineRepositoryContract } from "./repository-contract.ts";

defineRepositoryContract("in-memory repositories", (effect) =>
  Effect.runPromise(effect.pipe(Effect.provide(InMemoryCoffeeRepositoriesLive))),
);

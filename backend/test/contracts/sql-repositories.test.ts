import * as Effect from "effect/Effect";
import { SqlCoffeeRepositoriesTestLive } from "../support/D1Miniflare.ts";
import { defineRepositoryContract } from "./repository-contract.ts";

defineRepositoryContract("sql repositories", (effect) =>
  effect.pipe(Effect.provide(SqlCoffeeRepositoriesTestLive), Effect.scoped, Effect.orDie),
);

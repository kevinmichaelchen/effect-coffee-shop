import * as Effect from "effect/Effect";
import { defineRepositoryContract } from "@effect-coffee-shop/coffee-core/application/testing/repository-contract";
import { InMemoryCoffeeRepositoriesLive } from "../index.ts";

defineRepositoryContract("in-memory repositories", (effect) =>
  // oxlint-disable-next-line effect/effect-run-in-body -- Shared repository contract exposes a Promise runner to the native test harness.
  Effect.runPromise(effect.pipe(Effect.provide(InMemoryCoffeeRepositoriesLive))),
);

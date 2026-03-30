import * as Effect from "effect/Effect";
import type { MenuRepository } from "../../src/service/ports/MenuRepository.ts";
import type { OrderRepository } from "../../src/service/ports/OrderRepository.ts";
import { SqlCoffeeRepositoriesTestLive } from "../support/D1Miniflare.ts";
import { defineRepositoryContract } from "./repository-contract.ts";

const runSql = <A>(effect: Effect.Effect<A, never, MenuRepository | OrderRepository>) =>
  effect.pipe(Effect.provide(SqlCoffeeRepositoriesTestLive), Effect.scoped, Effect.orDie);

defineRepositoryContract("sql repositories", runSql);

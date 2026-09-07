import * as Option from "effect/Option";
import type { SqlCoffeeRepositoriesTestHarness } from "../testing/D1Alchemy.ts";
import { createSqlCoffeeRepositoriesTestHarness } from "../testing/D1Alchemy.ts";
import { afterAll, assert, beforeAll, beforeEach } from "vitest";
import { defineRepositoryContract } from "@effect-coffee-shop/coffee-core/application/testing/repository-contract";

let harness: Option.Option<SqlCoffeeRepositoriesTestHarness> = Option.none();

const getHarness = () => {
  if (Option.isNone(harness)) {
    assert.fail("SQL repository test harness is not initialized");
  }

  return harness.value;
};

beforeAll(async () => {
  harness = Option.some(await createSqlCoffeeRepositoriesTestHarness());
});

beforeEach(async () => {
  await getHarness().reset();
});

afterAll(async () => {
  await getHarness().dispose();
});

defineRepositoryContract("sql repositories", (effect) => getHarness().run(effect));

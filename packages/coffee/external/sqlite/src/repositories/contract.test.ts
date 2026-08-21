import type { SqlCoffeeRepositoriesTestHarness } from "../testing/D1Alchemy.ts";
import { createSqlCoffeeRepositoriesTestHarness } from "../testing/D1Alchemy.ts";
import { afterAll, assert, beforeAll, beforeEach } from "vitest";
import { defineRepositoryContract } from "@effect-coffee-shop/coffee-core/application/testing/repository-contract";

let harness: SqlCoffeeRepositoriesTestHarness | undefined;

const getHarness = () => {
  if (harness === undefined) {
    assert.fail("SQL repository test harness is not initialized");
  }

  return harness;
};

beforeAll(async () => {
  harness = await createSqlCoffeeRepositoriesTestHarness();
});

beforeEach(async () => {
  await getHarness().reset();
});

afterAll(async () => {
  await getHarness().dispose();
});

defineRepositoryContract("sql repositories", (effect) => getHarness().run(effect));

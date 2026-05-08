import type { SqlCoffeeRepositoriesTestHarness } from "../support/D1Miniflare.ts";
import { createSqlCoffeeRepositoriesTestHarness } from "../support/D1Miniflare.ts";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { defineRepositoryContract } from "./repository-contract.ts";

let harness: SqlCoffeeRepositoriesTestHarness | undefined;

const getHarness = () => {
  if (harness === undefined) {
    throw new Error("SQL repository test harness is not initialized");
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

import type { D1Database } from "@cloudflare/workers-types";
import { createCoffeeAuth, resolveCoffeeActor } from "./shared.ts";

export async function ensureCloudflareAuthPersistence(_input: {
  readonly db: D1Database;
}): Promise<void> {}

export function createCloudflareAuth(input: {
  readonly db: D1Database;
  readonly request: Request;
  readonly secret: string;
}) {
  return createCoffeeAuth({
    database: input.db,
    request: input.request,
    secret: input.secret,
  });
}

export async function resolveCloudflareActor(input: {
  readonly db: D1Database;
  readonly request: Request;
  // oxlint-disable-next-line effect/prefer-option-over-null -- Better Auth SDK represents absent secrets and registration context with nullish values.
  readonly secret: string | undefined;
  readonly staffUserIds: ReadonlySet<string>;
}) {
  return resolveCoffeeActor({
    database: input.db,
    request: input.request,
    secret: input.secret,
    staffUserIds: input.staffUserIds,
  });
}

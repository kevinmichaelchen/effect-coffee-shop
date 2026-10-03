import type { D1Database } from "@cloudflare/workers-types";
import { createCoffeeAuth, resolveCoffeeActor } from "./shared.ts";

// Local D1 RPC proxies don't expose method membership to Better Auth's dialect
// detection. Forward explicitly so both proxies and Worker bindings have the
// same structural database interface, retaining the original receiver.
const authDatabase = (db: D1Database): D1Database => ({
  prepare: db.prepare.bind(db),
  batch: db.batch.bind(db),
  exec: db.exec.bind(db),
  withSession: db.withSession.bind(db),
  dump: db.dump.bind(db),
});

export async function ensureCloudflareAuthPersistence(_input: {
  readonly db: D1Database;
}): Promise<void> {}

export function createCloudflareAuth(input: {
  readonly db: D1Database;
  readonly request: Request;
  readonly secret: string;
}) {
  return createCoffeeAuth({
    database: authDatabase(input.db),
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
    database: authDatabase(input.db),
    request: input.request,
    secret: input.secret,
    staffUserIds: input.staffUserIds,
  });
}

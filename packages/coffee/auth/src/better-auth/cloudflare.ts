import type { D1Database } from "@cloudflare/workers-types";
import type { createCoffeeAgentAuthOptions } from "../agent/options.ts";
import { createCoffeeAuth, resolveCoffeeActor } from "./shared.ts";

type CoffeeAuthAppLayer = Parameters<typeof createCoffeeAgentAuthOptions>[0]["appLayer"];

export async function ensureCloudflareAuthPersistence(_input: {
  readonly db: D1Database;
}): Promise<void> {}

export function createCloudflareAuth(input: {
  readonly appLayer: CoffeeAuthAppLayer;
  readonly db: D1Database;
  readonly request: Request;
  readonly secret: string;
}) {
  return createCoffeeAuth({
    appLayer: input.appLayer,
    database: input.db,
    request: input.request,
    secret: input.secret,
  });
}

export async function resolveCloudflareActor(input: {
  readonly appLayer: CoffeeAuthAppLayer;
  readonly db: D1Database;
  readonly request: Request;
  readonly secret: string | undefined;
  readonly staffUserIds: ReadonlySet<string>;
}) {
  return resolveCoffeeActor({
    appLayer: input.appLayer,
    database: input.db,
    request: input.request,
    secret: input.secret,
    staffUserIds: input.staffUserIds,
  });
}

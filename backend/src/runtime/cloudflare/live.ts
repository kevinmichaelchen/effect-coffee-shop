import type { D1Database } from "@cloudflare/workers-types";
import { D1Client } from "@effect/sql-d1";
import * as Layer from "effect/Layer";
import { SqlCoffeeCoreLive } from "#external/live";
import { InMemoryEmailServiceLive } from "#external/in-memory/InMemoryEmailService";
import { CloudflareEmailServiceLive } from "#external/cloudflare/CloudflareEmailService";
import type { SendEmailBinding } from "#external/cloudflare/CloudflareEmailService";

export const makeCloudflareCoffeeAppLive = (db: D1Database, email?: SendEmailBinding) =>
  Layer.mergeAll(
    SqlCoffeeCoreLive,
    email ? CloudflareEmailServiceLive(email) : InMemoryEmailServiceLive,
  ).pipe(Layer.provide(D1Client.layer({ db })));

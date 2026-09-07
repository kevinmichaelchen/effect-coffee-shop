// Cryptographic adapter shared by Bun and Workers' nodejs_compat runtime.
import { createHash, timingSafeEqual } from "node:crypto";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { CacheConfig } from "./config.ts";
import { CacheError } from "./domain.ts";

const digest = (value: string) => createHash("sha256").update(value).digest();

export const authorize = Effect.fn("TurboCache.authorize")(function* (request: Request, url: URL) {
  const config = yield* CacheConfig;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([a-zA-Z0-9_-]{32,256})$/i.exec(header);
  const presented = digest(match?.[1] ?? "");
  // Compare both digests even when one matches; never compare raw secret strings.
  const writer = timingSafeEqual(presented, digest(Redacted.value(config.writeToken)));
  const reader = timingSafeEqual(presented, digest(Redacted.value(config.readToken)));
  if (!writer && !reader) {
    return yield* Effect.fail(new CacheError({ status: 401, message: "Unauthorized" }));
  }
  // Turbo preflights before adding team query parameters. Authenticate the
  // token here; the subsequent artifact request still enforces its tenant.
  if (request.method === "OPTIONS") return config;
  const teamId = url.searchParams.get("teamId");
  const slug = url.searchParams.get("slug");
  if (
    (teamId === null && slug === null) ||
    (teamId !== null && teamId !== config.team) ||
    (slug !== null && slug !== config.team)
  ) {
    return yield* Effect.fail(new CacheError({ status: 403, message: "Team access denied" }));
  }
  if (request.method === "PUT" && !writer) {
    return yield* Effect.fail(new CacheError({ status: 403, message: "Write access denied" }));
  }
  return config;
});

import * as Effect from "effect/Effect";
import * as Mac from "effect/crypto/Mac";
import * as Redacted from "effect/Redacted";
import { CacheConfig } from "./config.ts";
import { CacheError } from "./domain.ts";

// Web Crypto is available in both Bun and Workers, so no Node API is needed.
const digest = (value: string) =>
  Effect.promise(async () => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).pipe(
    Effect.map((buffer) => new Uint8Array(buffer)),
  );

export const authorize = Effect.fn("TurboCache.authorize")(function* (request: Request, url: URL) {
  const config = yield* CacheConfig;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([a-zA-Z0-9_-]{32,256})$/i.exec(header);
  const presented = yield* digest(match?.[1] ?? "");
  // Compare both fixed-length digests even when one matches; never compare raw secret strings.
  const writer = Mac.timingSafeEqual(presented, yield* digest(Redacted.value(config.writeToken)));
  const reader = Mac.timingSafeEqual(presented, yield* digest(Redacted.value(config.readToken)));
  if (!writer && !reader) {
    return yield* new CacheError({ status: 401, message: "Unauthorized" });
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
    return yield* new CacheError({ status: 403, message: "Team access denied" });
  }
  if (request.method === "PUT" && !writer) {
    return yield* new CacheError({ status: 403, message: "Write access denied" });
  }
  return config;
});

import { describe, expect, it } from "@effect/vitest";
import * as Domain from "@alchemy.run/domain";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import type { AuthDeployment } from "@effect-coffee-shop/coffee-auth/config";
import { CoffeeShop, CoffeeShopHandlers } from "@effect-coffee-shop/coffee-domain/CoffeeShop.model";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as References from "effect/References";
import type * as Scope from "effect/Scope";
import * as HttpServerError from "effect/http/HttpServerError";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerRequestModule from "effect/http/HttpServerRequest";
import { TestClock } from "effect/testing";
import type { CoffeeDeployment, CoffeeGeneration, DomainToolServices } from "../src/CoffeeHttp.ts";
import { type CoffeeGenerations, coffeeGenerations } from "../src/Generation.ts";
import { SessionLive } from "../src/Session.ts";
import { authDatabase } from "./auth-database.ts";

/** The model over the in-memory platform, as the Worker's hosts provide it. */
const World = Layer.mergeAll(SessionLive, CoffeeOrderApp.layer).pipe(
  Layer.provideMerge(CoffeeShop.layer(CoffeeShopHandlers)),
  Layer.provide(Domain.InMemory),
  Layer.provide(Layer.succeed(References.MinimumLogLevel, "Warn")),
);

const deployment: AuthDeployment = {
  origin: "http://localhost",
  oauthSecret: Redacted.make("A".repeat(43)),
  mcpClients: [],
  staffUserIds: HashSet.empty<string>(),
};

const secret = (value: string) => Redacted.make(`generation-test-secret-${value}`.padEnd(32, "-"));

/** One test's deployment: the model's services and a migrated D1, scoped to the test. */
const withDeployment = <A, E>(use: (input: CoffeeDeployment) => Effect.Effect<A, E, Scope.Scope>) =>
  Effect.gen(function* () {
    return yield* use({
      auth: deployment,
      database: yield* authDatabase(),
      app: yield* CoffeeOrderApp,
      domain: yield* Effect.context<DomainToolServices>(),
    });
  }).pipe(Effect.provide(World));

/** What one request does: pick the generation the secret it read resolves to. */
const request = (
  generations: CoffeeGenerations,
  read: Effect.Effect<Redacted.Redacted, string>,
): Effect.Effect<CoffeeGeneration, never, Scope.Scope> =>
  Effect.scoped(generations.forRequest(read));

/** A request as the app's browser sends one: same origin on every mutation. */
const serving = (path: string, method = "GET") =>
  HttpServerRequestModule.fromWeb(
    new Request(`http://localhost${path}`, { method, headers: { origin: "http://localhost" } }),
  );

/** The response a generation serves for one request, failures answered as the Worker does. */
const call = (generation: CoffeeGeneration, path: string, method = "GET") =>
  generation.http.pipe(
    Effect.provideService(HttpServerRequest, serving(path, method)),
    Effect.scoped,
    Effect.catchCause((cause) =>
      Effect.map(HttpServerError.causeResponse(cause), ([response]) => response),
    ),
    Effect.map((response) => response.status),
  );

describe("the generations a Worker builds", () => {
  it.live(
    "build one router and one auth per secret, and a new pair for a new secret",
    () =>
      withDeployment((input) =>
        Effect.gen(function* () {
          const generations = yield* coffeeGenerations(input);
          const first = yield* request(generations, Effect.succeed(secret("a")));
          const again = yield* request(generations, Effect.succeed(secret("a")));
          expect(again.http).toBe(first.http);
          expect(again.auth).toBe(first.auth);
          // One router per generation: each answers its own auth routes.
          expect(yield* call(first, "/api/auth/requireSession")).toBe(400);
          expect(yield* call(again, "/api/auth/requireSession")).toBe(400);

          const rotated = yield* request(generations, Effect.succeed(secret("b")));
          expect(rotated.http).not.toBe(first.http);
          expect(rotated.auth).not.toBe(first.auth);
          expect(yield* call(rotated, "/api/auth/requireSession")).toBe(400);
        }),
      ),
    30_000,
  );

  it.live(
    "serve the request at hand, not the one that built the generation",
    () =>
      withDeployment((input) =>
        Effect.gen(function* () {
          const generations = yield* coffeeGenerations(input);
          // A generation built while answering one request must serve the next
          // one: auth's handlers take their services from the build context.
          const generation = yield* request(generations, Effect.succeed(secret("a"))).pipe(
            Effect.provideService(HttpServerRequest, serving("/api/health")),
          );
          // The generation answers the request at hand: auth's own session
          // route refuses this one (400) and a mutation reaches auth's CSRF
          // admission (403), where a generation stuck on the request that
          // built it would answer both with the router's 404.
          expect([
            yield* call(generation, "/api/auth/requireSession"),
            yield* call(generation, "/api/auth/getSession", "POST"),
            yield* call(generation, "/api/auth/nothing"),
          ]).toEqual([400, 403, 404]);
        }),
      ),
    30_000,
  );

  it.live(
    "never remember a secret read that failed",
    () =>
      withDeployment((input) =>
        Effect.gen(function* () {
          const generations = yield* coffeeGenerations(input);
          const unreadable = Effect.fail("AUTH_SECRET is unavailable");
          const first = yield* request(generations, unreadable);
          const again = yield* request(generations, unreadable);
          // No auth, and a router of its own each time: nothing was cached.
          expect(Option.isNone(first.auth)).toBe(true);
          expect(again.http).not.toBe(first.http);
        }),
      ),
    30_000,
  );

  it.effect(
    "release a generation nobody has used for five minutes",
    () =>
      withDeployment((input) =>
        Effect.gen(function* () {
          const generations = yield* coffeeGenerations(input);
          const first = yield* request(generations, Effect.succeed(secret("a")));
          yield* request(generations, Effect.succeed(secret("a")));
          yield* TestClock.adjust(Duration.minutes(5));
          const rebuilt = yield* request(generations, Effect.succeed(secret("a")));
          expect(rebuilt.http).not.toBe(first.http);
          expect(rebuilt.auth).not.toBe(first.auth);
        }),
      ),
    30_000,
  );
});

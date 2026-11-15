/**
 * The auth-dependent half of the backend, built once per `AUTH_SECRET`.
 *
 * The secret is read on every request: a Secrets Store `get()` is a cheap
 * binding read, and reading it live is what lets a rotation take effect without
 * a redeploy. Its digest keys a cache of *generations* — one built auth and one
 * built router, shared by every request presenting that secret — so a request
 * costs a digest and a cache lookup instead of an `Auth.make` and a route graph.
 *
 * A generation nobody has used for `idleTimeToLive` is released, which retires
 * a rotated secret's generation. Nothing relies on isolate teardown: workerd
 * never runs it.
 *
 * @module
 */
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as Hash from "effect/Hash";
import * as Layer from "effect/Layer";
import * as LayerMap from "effect/LayerMap";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import { Digest } from "effect/crypto";
import {
  type CoffeeDeployment,
  type CoffeeGeneration,
  anonymousGeneration,
  coffeeGeneration,
} from "./CoffeeHttp.ts";

/** How long an unused generation stays built: long enough to serve a quiet Worker, short enough to retire a rotated secret. */
const idleTimeToLive = Duration.minutes(5);

/** A generation, as the Context service the cache hands out. */
export class Generation extends Context.Service<Generation, CoffeeGeneration>()(
  "@effect-coffee-shop/coffee-server/Generation",
) {}

/**
 * An `AUTH_SECRET` as a generation cache key: equal and hashed by its digest,
 * so the secret never keys — or is printed from — the cache.
 */
export class SecretKey
  extends Schema.Class<SecretKey, { readonly brand: unique symbol }>("SecretKey")({
    secret: Schema.Redacted(Schema.String),
    digest: Schema.String,
  })
  implements Eq.Equal
{
  [Eq.symbol](that: Eq.Equal): boolean {
    return Schema.is(SecretKey)(that) && this.digest === that.digest;
  }

  [Hash.symbol](): number {
    return Hash.string(this.digest);
  }
}

/** The cached generations, and how a request picks the one it is served by. */
export interface CoffeeGenerations {
  /**
   * The generation a request is served by: the one `read` resolves to, or the
   * anonymous surface built for this request when it cannot be read.
   */
  readonly forRequest: <E, R>(
    read: Effect.Effect<Redacted.Redacted, E, R>,
  ) => Effect.Effect<CoffeeGeneration, never, Scope.Scope | R>;
}

/**
 * The generation cache. Its own scope is never closed — workerd has no
 * teardown hook — while each generation lives in the cache entry's scope,
 * closed when the entry is retired.
 */
export const coffeeGenerations = (input: CoffeeDeployment) =>
  Effect.gen(function* () {
    const digests = yield* Digest.Digest;
    // A generation outlives the request that built it, so it is built from the
    // isolate's own services: auth's HTTP handlers take their services from the
    // context they are built in, and would otherwise capture that request.
    const isolate = yield* Effect.context();
    const generations = yield* LayerMap.make(
      (key: SecretKey) =>
        Layer.effect(
          Generation,
          Effect.flatMap(Scope.Scope, (scope) =>
            coffeeGeneration(input, key.secret).pipe(
              Effect.setContext(Context.add(isolate, Scope.Scope, scope)),
            ),
          ),
        ),
      { idleTimeToLive },
    ).pipe(Effect.provideService(Scope.Scope, Scope.makeUnsafe()));
    const forSecret = Effect.fn("CoffeeGenerations.forSecret")(function* (
      secret: Redacted.Redacted,
    ) {
      const digest = yield* digests.digestHex(
        Digest.sha256,
        new TextEncoder().encode(`coffee/generation/v1:${Redacted.value(secret)}`),
      );
      return Context.get(
        yield* generations.contextEffect(new SecretKey({ secret, digest })),
        Generation,
      );
    });
    return {
      forRequest: (read) =>
        Effect.option(read).pipe(
          Effect.flatMap((secret) =>
            Option.match(secret, {
              onNone: () => anonymousGeneration(input),
              onSome: forSecret,
            }),
          ),
        ),
    } satisfies CoffeeGenerations;
  }).pipe(
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- Called from the Worker's entry point, which owns layer assembly; the digest needs no lifetime.
    Effect.provide(Digest.layerWebCrypto),
  );

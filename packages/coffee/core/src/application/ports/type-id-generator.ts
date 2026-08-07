import type { TypeIdFactory, TypeIdOf } from "@just-be/effect-typed-id";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";

export interface TypeIdGenerator<TId> {
  readonly next: Effect.Effect<TId>;
}

const GlobalCrypto = Crypto.make({
  randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
  digest: () => Effect.die("GlobalCrypto.digest is not used by TypeID generation"),
});

export const makeTypeIdGenerator = <const Name extends string>(
  factory: TypeIdFactory<Name>,
): TypeIdGenerator<TypeIdOf<Name>> => ({
  next: factory.generate.pipe(Effect.provideService(Crypto.Crypto, GlobalCrypto), Effect.orDie),
});

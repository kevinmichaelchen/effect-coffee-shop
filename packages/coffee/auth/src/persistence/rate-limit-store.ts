import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { KeyValueStore } from "effect/persistence";
import { SqlClient } from "effect/sql";

const Rows = Schema.Array(Schema.Struct({ value: Schema.String }));
const Count = Schema.Tuple([Schema.Struct({ count: Schema.FiniteFromString })]);
const storageError = (method: string) =>
  Effect.mapError(
    (cause) =>
      new KeyValueStore.KeyValueStoreError({
        method,
        message: "Auth rate-limit storage is unavailable.",
        cause,
      }),
  );

/**
 * String storage for Yielded's supplied limiter. Effect 4's layerSql assumes
 * Uint8Array blob results; D1 returns number arrays. Keep this adapter textual
 * and let KeyValueStore.makeStringOnly supply the remaining store operations.
 */
export const AuthRateLimitStoreLive = Layer.effect(
  KeyValueStore.KeyValueStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const get = Effect.fn("AuthRateLimitStore.get")(function* (key: string) {
      const rows = yield* sql`select value from coffee_auth_rate_limits where id = ${key}`;
      const decoded = yield* Schema.decodeUnknownEffect(Rows)(rows);
      return decoded[0]?.value;
    }, storageError("get"));
    const set = Effect.fn("AuthRateLimitStore.set")((key: string, value: string) =>
      sql`insert into coffee_auth_rate_limits (id, value) values (${key}, ${value}) on conflict(id) do update set value = excluded.value`.pipe(
        Effect.asVoid,
        storageError("set"),
      ),
    );
    const remove = Effect.fn("AuthRateLimitStore.remove")((key: string) =>
      sql`delete from coffee_auth_rate_limits where id = ${key}`.pipe(
        Effect.asVoid,
        storageError("remove"),
      ),
    );
    const size = sql`select cast(count(*) as text) as count from coffee_auth_rate_limits`.pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Count)),
      Effect.map(([row]) => row.count),
      storageError("size"),
    );
    return KeyValueStore.makeStringOnly({
      get,
      set,
      remove,
      size,
      clear: sql`delete from coffee_auth_rate_limits`.pipe(Effect.asVoid, storageError("clear")),
    });
  }),
);

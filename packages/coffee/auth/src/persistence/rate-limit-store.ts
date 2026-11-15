import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { KeyValueStore } from "effect/persistence";
import { SqlClient } from "effect/sql";

const Rows = Schema.Array(Schema.Struct({ value: Schema.String }));
const Count = Schema.Tuple([Schema.Struct({ count: Schema.FiniteFromString })]);
const Keys = Schema.Array(Schema.Struct({ id: Schema.String }));
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
 * Longer than the longest limiter window, so an idle bucket refills before its
 * entry disappears. Expiry only bounds storage: a deleted bucket starts full.
 */
const entryTtlMillis = Duration.toMillis(Duration.hours(24));

/**
 * String storage for Yielded's supplied limiter. Effect 4's layerSql assumes
 * Uint8Array blob results; D1 returns number arrays. Keep this adapter textual
 * and let KeyValueStore.makeStringOnly supply the remaining store operations.
 *
 * Entries expire (Yielded requires a TTL of at least the longest window):
 * reads ignore expired rows and each write prunes them.
 */
export const AuthRateLimitStoreLive = Layer.effect(
  KeyValueStore.KeyValueStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const get = Effect.fn("AuthRateLimitStore.get")(function* (key: string) {
      const at = yield* Clock.currentTimeMillis;
      const rows =
        yield* sql`select value from coffee_auth_rate_limits where id = ${key} and expires_at > ${at}`;
      const decoded = yield* Schema.decodeUnknownEffect(Rows)(rows);
      return decoded[0]?.value;
    }, storageError("get"));
    const set = Effect.fn("AuthRateLimitStore.set")(function* (key: string, value: string) {
      const at = yield* Clock.currentTimeMillis;
      yield* sql`delete from coffee_auth_rate_limits where expires_at <= ${at}`;
      yield* sql`insert into coffee_auth_rate_limits (id, value, expires_at) values (${key}, ${value}, ${at + entryTtlMillis}) on conflict(id) do update set value = excluded.value, expires_at = excluded.expires_at`;
    }, storageError("set"));
    const remove = Effect.fn("AuthRateLimitStore.remove")((key: string) =>
      sql`delete from coffee_auth_rate_limits where id = ${key}`.pipe(
        Effect.asVoid,
        storageError("remove"),
      ),
    );
    const size = Clock.currentTimeMillis.pipe(
      Effect.flatMap(
        (at) =>
          sql`select cast(count(*) as text) as count from coffee_auth_rate_limits where expires_at > ${at}`,
      ),
      Effect.flatMap(Schema.decodeUnknownEffect(Count)),
      Effect.map(([row]) => row.count),
      storageError("size"),
      Effect.withSpan("AuthRateLimitStore.size"),
    );
    const keys = Clock.currentTimeMillis.pipe(
      Effect.flatMap((at) => sql`select id from coffee_auth_rate_limits where expires_at > ${at}`),
      Effect.flatMap(Schema.decodeUnknownEffect(Keys)),
      Effect.map((rows) => rows.map((row) => row.id)),
      storageError("keys"),
      Effect.withSpan("AuthRateLimitStore.keys"),
    );
    return KeyValueStore.makeStringOnly({
      get,
      set,
      remove,
      keys,
      size,
      clear: sql`delete from coffee_auth_rate_limits`.pipe(Effect.asVoid, storageError("clear")),
    });
  }),
);

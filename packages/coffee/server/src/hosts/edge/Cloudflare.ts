/**
 * The Cloudflare edge: the Coffee Worker's settings, and auth on Cloudflare D1
 * and Secrets Store. Both Workers run on Cloudflare, so both use it; the
 * model's host is chosen separately, in `../model/`.
 *
 * @module
 */
import * as Alchemy from "alchemy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import { d1AuthDatabase } from "@effect-coffee-shop/coffee-auth/adapters/d1";
import { authMigrations } from "@effect-coffee-shop/coffee-auth/migrations";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { AuthSecret, AuthSecretUnavailable, AuthStorage } from "../../CoffeeServer.ts";

/** Passkeys, sessions and MCP OAuth grants. Orders and carts live in the model. */
const AuthD1 = Cloudflare.D1.Database("coffee-db", {
  migrations: decodeURIComponent(authMigrations.pathname),
});

const AuthSecretStore = Cloudflare.SecretsStore.Store("coffee-secrets");

/** Set `AUTH_SECRET` to choose the secret; otherwise Alchemy mints one and keeps it. */
const authSecretName = "AUTH_SECRET";

const providedSecret = Config.Redacted(authSecretName).pipe(
  Config.option,
  Config.map(Option.filter((secret) => Redacted.value(secret).trim() !== "")),
);

const authSecretResource = Effect.fn("CloudflareAuth.secretResource")(function* () {
  const store = yield* AuthSecretStore;
  const value = yield* Option.match(yield* providedSecret, {
    onNone: () =>
      Alchemy.Random("auth-secret", { bytes: 32 }).pipe(Effect.map((random) => random.text)),
    onSome: Effect.succeed,
  });
  // The logical id names the Worker's binding, so it must differ from the
  // AUTH_SECRET env var read above.
  return yield* Cloudflare.SecretsStore.Secret("AuthSecret", {
    comment: "Yielded Auth request-binding secret for the Coffee Shop Worker.",
    name: authSecretName,
    store,
    value,
  });
});

const storage = Layer.effect(
  AuthStorage,
  Effect.gen(function* () {
    const db = yield* Cloudflare.D1.QueryDatabase(yield* AuthD1);
    return { database: Effect.map(db.raw, d1AuthDatabase) };
  }),
);

const secret = Layer.effect(
  AuthSecret,
  Effect.gen(function* () {
    const read = yield* Cloudflare.SecretsStore.ReadSecret(yield* authSecretResource());
    return { read: Effect.mapError(read, () => new AuthSecretUnavailable()) };
  }),
);

/** `AuthStorage` on D1 and `AuthSecret` in Secrets Store, bound to this Worker. */
export const CloudflareAuth = Layer.mergeAll(storage, secret).pipe(
  Layer.provide(
    Layer.mergeAll(Cloudflare.D1.QueryDatabaseBinding, Cloudflare.SecretsStore.ReadSecretBinding),
  ),
);

/** The Worker settings; `main` is the Worker's own module. */
export const coffeeWorkerSettings = (main: string) => ({
  main,
  compatibility: { flags: ["nodejs_compat"] },
  observability: {
    enabled: true,
    logs: { enabled: true, invocationLogs: true, persist: true },
    traces: { enabled: true, persist: true },
  },
});

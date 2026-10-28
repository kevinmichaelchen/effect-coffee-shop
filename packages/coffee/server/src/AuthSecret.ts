/**
 * The Yielded Auth request-binding secret, kept in Cloudflare Secrets Store.
 * Set `AUTH_SECRET` to choose it; otherwise Alchemy mints one and keeps it
 * across deploys.
 *
 * @module
 */
import * as Alchemy from "alchemy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

export const authSecretName = "AUTH_SECRET";

const AuthSecretStore = Cloudflare.SecretsStore.Store("coffee-secrets");

const providedSecret = Config.Redacted(authSecretName).pipe(
  Config.option,
  Config.map(Option.filter((secret) => Redacted.value(secret).trim() !== "")),
);

export const authSecret = Effect.fn("CoffeeServer.authSecret")(function* () {
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

import type * as OAuthServer from "@yielded/auth/OAuthServer";
import { Auth, Http, Passkey } from "@yielded/auth";
import { SqlBatchCommit } from "@yielded/auth-persistence/Adapter";
import * as Effect from "effect/Effect";
import * as Crypto from "effect/Crypto";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { Base64Url } from "effect/encoding";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import type { SqlClient } from "effect/sql";
import { CurrentActor, anonymousActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { CoffeeAuth } from "./auth.ts";
import { actorFromIdentity } from "./yielded/identity.ts";
import type { AuthAdapters } from "./adapters.ts";

export interface AuthServerConfig {
  readonly origin: string;
  readonly oauthSecret: Redacted.Redacted<string>;
  readonly mcpClients: ReadonlyArray<OAuthServer.Client>;
  readonly secret: Redacted.Redacted<string>;
  readonly staffUserIds: ReadonlySet<string>;
}

export class AuthUnavailable extends Schema.TaggedError<AuthUnavailable>()("AuthUnavailable", {}) {}

export const makeCoffeeAuth = <E>(
  config: AuthServerConfig,
  database: Layer.Layer<SqlClient.SqlClient | SqlBatchCommit, E>,
  adapters: AuthAdapters,
) => {
  const origin = new URL(config.origin);
  const crypto = adapters.crypto;
  const binding = Layer.unwrap(
    Effect.gen(function* () {
      yield* Schema.decodeEffect(Schema.String.check(Schema.isMinLength(32)))(
        Redacted.value(config.secret),
      ).pipe(Effect.mapError(() => new AuthUnavailable()));
      const cryptography = yield* Crypto.Crypto;
      const digest = yield* cryptography.digest(
        "SHA-256",
        new TextEncoder().encode(`coffee/request-binding/v1:${Redacted.value(config.secret)}`),
      );
      return Auth.RequestBindingConfig.layer({
        lifetimeMillis: 300_000,
        generation: 1,
        keyring: {
          activeKeyId: "v1",
          keys: [{ id: "v1", material: Redacted.make(Base64Url.encode(digest)) }],
        },
      });
    }),
  );
  const http = Http.make(CoffeeAuth, {
    origin: origin.origin,
    cookie: {
      secure: origin.protocol === "https:",
      prefix: origin.protocol === "https:" ? "__Host-coffee-" : "coffee-",
    },
  });
  const passkeyConfig = Passkey.PasskeyConfig.layer({
    id: origin.hostname,
    name: "Effect Coffee Shop",
    origins: [origin.origin],
    developmentLocalhost: origin.protocol === "http:",
  });
  const dependencies = Layer.mergeAll(
    binding.pipe(Layer.provide(crypto)),
    database,
    crypto,
    passkeyConfig,
    adapters.passkeys.pipe(Layer.provide(passkeyConfig)),
  );
  const auth = http.layer.pipe(
    Layer.provide(adapters.storage),
    Layer.provide(adapters.rateLimits),
    Layer.provide(dependencies),
  );
  const actor = Effect.fn("CoffeeAuth.currentActor")(function* () {
    const api = yield* CoffeeAuth;
    const session = yield* api.getSession();
    return session === null
      ? anonymousActor
      : yield* actorFromIdentity(
          {
            subjectId: session.subjectId,
            displayName: session.claims.displayName,
          },
          config.staffUserIds,
        );
  });
  const middleware = HttpRouter.middleware<{ provides: CurrentActor }>()(
    Effect.context<Layer.Success<typeof auth>>().pipe(
      Effect.map(
        (services) => (effect) =>
          Effect.gen(function* () {
            const request = yield* HttpServerRequest.HttpServerRequest;
            if (
              !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
              request.headers.origin !== origin.origin
            ) {
              return HttpServerResponse.empty({ status: 403 });
            }
            return yield* http
              .withRequest(
                Effect.flatMap(actor(), (actor) =>
                  Effect.provideService(effect, CurrentActor, actor),
                ),
              )
              .pipe(Effect.provideContext(services));
          }),
      ),
    ),
  );
  const routes = http.routes().pipe(Layer.provide(auth));
  return { auth, http, actor, routes, middleware, crypto };
};

export type CoffeeAuthLayers<E> = ReturnType<typeof makeCoffeeAuth<E>>;

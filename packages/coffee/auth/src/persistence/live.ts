import { Hooks, Passkey, Sessions } from "@yielded/auth";
import {
  makeNativeSqlTables,
  makeStorageMappings,
  makeNativeAuthenticationAuthorityServices,
  makeNativePendingAuthenticationServices,
  makeNativeStatefulSessionServices,
  makeNativeSessionStepUpServices,
  makeNativeSessionCleanupServices,
} from "@yielded/auth-persistence/Adapter";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { SqlClient } from "effect/sql";
import { CoffeeAuth } from "../auth.ts";
import { Claims } from "../contract.ts";
import { storage } from "./schema.ts";
// oxlint-disable-next-line effect/no-service-constructor-imports -- This persistence composition layer acquires Yielded native services with the shared SQL table adapter.
import { makePasskeyStorage } from "./passkeys.ts";

export const AuthStorageLive = Layer.effectContext(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const tables = makeNativeSqlTables(sql);
    const mappings = yield* makeStorageMappings(storage);
    const sessionBase = mappings.sessions(Claims, CoffeeAuth.sessions.moduleId);
    const pendingBase = mappings.pending(Claims, CoffeeAuth.sessions.moduleId);
    const subject = { ...sessionBase.subject, requirementColumns: [] };
    const sessionMapping = { ...sessionBase, subject };
    const pendingMapping = { ...pendingBase, subject };
    const sessions = yield* makeNativeStatefulSessionServices(tables, sessionMapping);
    const authority = yield* makeNativeAuthenticationAuthorityServices(tables, sessionMapping);
    const pending = yield* makeNativePendingAuthenticationServices(tables, pendingMapping);
    const stepUp = yield* makeNativeSessionStepUpServices(tables, {
      ...pendingMapping,
      source: {
        kind: "Stateful",
        session: sessionMapping.session,
        sessionId: sessionMapping.sessionId,
        constraints: { sessionDigest: "unique(session.digest)" },
      },
    });
    const cleanup = yield* makeNativeSessionCleanupServices(tables, pendingMapping);
    const passkeys = yield* makePasskeyStorage(tables);
    const resolveClaims = Effect.fn("CoffeeAuth.resolveClaims")(
      function* ({ subjectId }: { readonly subjectId: string }) {
        const rows =
          yield* sql`select display_name as "displayName" from coffee_auth_subjects where id = ${subjectId} and active = ${sql.onDialectOrElse({ pg: () => true, orElse: () => 1 })}`;
        const [claims] = yield* Schema.decodeUnknownEffect(Schema.Tuple([Claims]))(rows);
        return claims;
      },
      Effect.mapError(() => Passkey.PasskeyUnavailable.make({})),
    );
    return Context.make(Sessions.AuthenticationAuthority, authority.authenticationAuthority).pipe(
      Context.add(
        CoffeeAuth.sessions.StatefulSessionPersistence,
        sessions.statefulSessionPersistence,
      ),
      Context.add(CoffeeAuth.sessions.SessionRepository, sessions.sessionRepository),
      Context.add(CoffeeAuth.sessions.PendingAuthentication, pending.pendingAuthentication),
      Context.add(CoffeeAuth.sessions.SessionStepUpPersistence, stepUp.sessionStepUpPersistence),
      Context.add(CoffeeAuth.sessions.SessionCleanup, cleanup.sessionCleanup),
      Context.add(Passkey.PasskeyPersistence, passkeys.passkeyPersistence),
      Context.add(Passkey.PasskeyCredentials, passkeys.passkeyCredentials),
      Context.add(
        CoffeeAuth.strategies.registration.RegistrationAuthority,
        passkeys.passkeyRegistrationAuthority,
      ),
      Context.add(CoffeeAuth.strategies.passkey.SessionClaims, { resolve: resolveClaims }),
    );
  }),
).pipe(Layer.provide(Hooks.LifecycleHooks.empty));

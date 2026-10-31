import { Hooks, Passkey, Sessions } from "@yielded/auth";
import {
  makeBatchPasskeyServices,
  makePasskeyNativeRegistration,
  requiredPasskeyCredentialConstraints,
  requiredPasskeyPersistenceConstraints,
  type NativePasskeyRegistrationMapping,
  type PasskeyClock,
  type NativeSqlTables,
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
import { authenticationRequirement, CoffeeAuth } from "../auth.ts";
import { Claims, passkeyNamespace, Registration } from "../contract.ts";
import { storage, subjects } from "./schema.ts";

const subjectRow = Schema.Struct({ id: Schema.String });
const credentialOwner = Schema.Struct({ subjectId: Schema.String });
const credentialData = Passkey.PasskeyCredential.mapFields(
  ({ revision: _revision, active: _active, requirement: _requirement, ...fields }) => ({
    ...fields,
    profile: Schema.fromJsonString(Passkey.PasskeyProfile),
  }),
);
const decodeCredentialData = Schema.decodeUnknownSync(credentialData);
const profileJson = Schema.fromJsonString(Passkey.PasskeyProfile);

/** Physical row codecs and predicates are confined to this SQL adapter. */
const passkeyStorage = Effect.fn("CoffeeAuth.passkeyStorage")(function* (tables: NativeSqlTables) {
  const sql = yield* SqlClient.SqlClient;
  const s = tables(subjects);
  const c = tables(storage.schema.passkeyCredentials);
  const f = tables(storage.schema.credentials);
  const isActive = Schema.is(Schema.Literal(true));
  const activeSubject = sql`${s.column("active")} = ${s.value("active", true)}`;
  const mapping = {
    moduleId: passkeyNamespace,
    read: {
      subject: {
        table: subjects,
        id: "id",
        status: "active",
        securityRevision: "securityRevision",
        decodeId: (row) => Schema.decodeUnknownSync(subjectRow)(row).id,
        decodeRequirement: () => Effect.succeed(authenticationRequirement),
        isActiveStatus: isActive,
        activeCondition: activeSubject,
      },
      credential: {
        table: storage.schema.passkeyCredentials,
        credentialId: "credentialId",
        subjectId: "subjectId",
        rpId: "rpId",
        protocolCredentialId: "protocolCredentialId",
        credentialKey: "credentialKey",
        userHandle: "userHandle",
        publicKey: "publicKey",
        algorithm: "algorithm",
        profile: "profile",
        credentialRevision: "credentialRevision",
        status: "active",
        primarySignIn: "primarySignIn",
        enrollmentUserVerified: "enrollmentUserVerified",
        backupEligible: "backupEligible",
        backupState: "backupState",
        counter: "counter",
        decode: decodeCredentialData,
        decodeSubjectId: (row) => Schema.decodeUnknownSync(credentialOwner)(row).subjectId,
        isActiveStatus: isActive,
        activeCondition: sql`${c.column("active")} = ${c.value("active", true)}`,
      },
      authority: {
        table: storage.schema.credentials,
        subjectId: "subjectId",
        credentialId: "credentialId",
        revision: "revision",
        status: "active",
        isActiveStatus: isActive,
        activeCondition: sql`${f.column("active")} = ${f.value("active", true)}`,
      },
      subjectIds: {
        toNative: storage.subjects.toNativeSync,
        toSubject: storage.subjects.toSubjectSync,
        equals: (left, right) => left === right,
      },
      constraints: requiredPasskeyCredentialConstraints,
    },
    flow: {
      table: storage.schema.passkeyFlows,
      moduleId: "moduleId",
      flowId: "flowId",
      purpose: "purpose",
      snapshot: "snapshot",
      requestBindingVerifier: "requestBindingVerifier",
      requestBindingExpiresAt: "requestBindingExpiresAt",
      issuedAt: "issuedAt",
      expiresAt: "expiresAt",
      encodeInsert: () => ({}),
    },
    clock: {
      encodeInstant: storage.encodeInstant,
      decodeInstant: storage.decodeInstantSync,
      engineNowMillis: sql.onDialectOrElse({
        pg: () => sql`cast(extract(epoch from clock_timestamp()) * 1000 as bigint)`,
        orElse: () => sql`cast(round((julianday('now') - 2440587.5) * 86400000) as integer)`,
      }),
      toMillis: (expression) => expression,
      fromMillis: (expression) => expression,
    } satisfies PasskeyClock,
    telemetry: {
      lastUsedAt: "lastUsedAt",
      encodeBackupEligible: (value) => value,
      encodeBackupState: (value) => value,
    },
    constraints: requiredPasskeyPersistenceConstraints,
    write: {
      credential: {
        name: "name",
        createdAt: "createdAt",
        encodeInsert: ({ credential, subjectId, summary, marker }) => ({
          ...credential,
          subjectId,
          credentialKey: "",
          credentialRevision: marker,
          profile: Schema.encodeSync(profileJson)(credential.profile),
          active: true,
          name: summary.name,
          createdAt: summary.createdAtMillis,
        }),
        encodePrimarySignIn: (value) => value,
        encodeEnrollmentUserVerified: (value) => value,
        encodeBackupEligible: (value) => value,
        activeStatus: true,
        removedStatus: false,
      },
      authority: {
        encodeInsert: ({ subjectId, credential, marker }) => ({
          subjectId,
          credentialId: credential.credentialId,
          revision: marker,
          active: true,
        }),
        activeStatus: true,
        removedStatus: false,
      },
      policy: {
        subjectColumns: ["displayName"],
        management: () => ({
          maximumCredentials: 5,
          maximumEvidenceAgeMillis: 300_000,
          requireImmediateInvalidation: true,
        }),
        requirement: () => Effect.succeed(authenticationRequirement),
        metadata: (id) =>
          sql`exists(select 1 from ${s.name} where ${s.column("id")} = ${s.value("id", id)} and ${activeSubject})`,
        action: () => sql`false`,
        remainingSignIn: () => Effect.succeed(sql`false`),
      },
    },
    applicationSnapshot: "applicationSnapshot",
    registration: {
      schema: Registration,
      describe: ({ displayName }) => ({ name: displayName, displayName }),
      eligible: () => sql`true`,
      finalEligibility: ({ registration, subjectId }) =>
        sql`exists(select 1 from ${s.name} where ${s.column("id")} = ${s.value("id", subjectId)} and ${s.column("displayName")} = ${registration.displayName} and ${activeSubject})`,
      subject: ({ registration, marker }) => {
        // Allocated at the trusted persistence boundary; clients cannot choose staff IDs.
        const subjectId = globalThis.crypto.randomUUID();
        return {
          subjectId,
          values: {
            id: subjectId,
            active: true,
            securityRevision: marker,
            displayName: registration.displayName,
          },
        };
      },
      activeStatus: true,
    },
  } satisfies NativePasskeyRegistrationMapping<Registration>;

  const services = yield* makeBatchPasskeyServices(tables, mapping);
  return { ...services, ...makePasskeyNativeRegistration(services, mapping) };
});

export const AuthStorageLive = Layer.effectContext(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const tables = makeNativeSqlTables(sql);
    const mappings = yield* makeStorageMappings(storage);
    const sessionBase = yield* mappings.sessions(Claims, CoffeeAuth.sessions.moduleId);
    const pendingBase = yield* mappings.pending(Claims, CoffeeAuth.sessions.moduleId);
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
    const passkeys = yield* passkeyStorage(tables);
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

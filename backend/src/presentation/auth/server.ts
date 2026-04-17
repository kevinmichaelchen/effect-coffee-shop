import type { BetterAuthOptions } from "better-auth";
import type * as Layer from "effect/Layer";
import { agentAuth } from "@better-auth/agent-auth";
import { passkey } from "@better-auth/passkey";
import { getMigrations } from "better-auth/db/migration";
import { betterAuth } from "better-auth";
import * as Schema from "effect/Schema";
import { createCoffeeAgentAuthOptions } from "#presentation/auth/agent-auth";
import { logStructuredEvent } from "#presentation/observability/logging";
import type { CoffeeOrderApp } from "#service/CoffeeOrderApp";
import { AppActorSchema, anonymousActor, type AppActor } from "#service/CurrentActor";

// Better-Auth's `database` option is itself a wide union (D1Database,
// SqliteDatabase, Dialect, Database, …) in @better-auth/core's types. Depending
// on that union — instead of typing the parameter as `D1Database` — keeps
// presentation/auth decoupled from Cloudflare; each runtime (Cloudflare,
// bun:sqlite, Postgres, …) just passes whichever shape fits its adapter.
type BetterAuthDatabase = BetterAuthOptions["database"];
type CoffeeAppLayer = Layer.Layer<CoffeeOrderApp, unknown, never>;

const syntheticEmailDomain = "users.coffee.invalid";
const longEnoughDevelopmentSecret = "dev-better-auth-secret-please-change-me-0001";
const provisionalUserPrefix = "passkey-signup-";

const PasskeyRegistrationContextSchema = Schema.Struct({
  displayName: Schema.String,
});

const decodeJsonString = Schema.decodeUnknownSync(Schema.UnknownFromJsonString);
const decodePasskeyRegistrationShape = Schema.decodeUnknownSync(PasskeyRegistrationContextSchema);

const decodeResolvedActor = Schema.decodeUnknownSync(AppActorSchema);

// One Better-Auth migration run per module (i.e. per Worker isolate / Bun
// process). The library's `getMigrations()` is expensive enough that we don't
// want to repeat it for every request, and a module-level promise is simpler
// than the previous WeakMap<D1Database, _> which coupled the cache to a
// Cloudflare-specific type.
let authPersistencePromise: Promise<void> | undefined;

export function getDisplayName(context: string | null | undefined): string {
  const parsed = decodePasskeyRegistrationShape(decodeJsonString(context ?? '{"displayName":""}'));
  const displayName = parsed.displayName.trim();

  if (displayName.length === 0) {
    throw new Error("displayName must not be blank");
  }

  return displayName;
}

function createSyntheticEmail(userId: string): string {
  return `${userId}@${syntheticEmailDomain}`;
}

export function createProvisionalUser(displayName: string) {
  const userId = `${provisionalUserPrefix}${crypto.randomUUID()}`;
  return {
    displayName,
    id: userId,
    name: displayName,
  };
}

export function createRegisteredUser(input: {
  readonly context: string | null | undefined;
  readonly userId: string;
}) {
  return {
    email: createSyntheticEmail(input.userId),
    id: input.userId,
    name: getDisplayName(input.context),
  };
}

function getRequestOrigin(request: Request | undefined): string | undefined {
  return request === undefined ? undefined : new URL(request.url).origin;
}

function getRequestHost(request: Request | undefined): string | undefined {
  return request === undefined ? undefined : new URL(request.url).hostname;
}

function getBetterAuthSecret(secret: string | undefined): string {
  return secret?.trim() || longEnoughDevelopmentSecret;
}

export interface AuthDependencies {
  readonly db: BetterAuthDatabase;
  readonly makeAppLayer: () => CoffeeAppLayer;
  readonly secret: string | undefined;
}

function buildAuthOptions(deps: AuthDependencies & { readonly request: Request | undefined }) {
  const origin = getRequestOrigin(deps.request);
  const host = getRequestHost(deps.request);

  return {
    appName: "Effect Coffee Shop",
    basePath: "/api/auth",
    database: deps.db,
    ...(origin === undefined ? {} : { baseURL: origin }),
    logger: {
      level: "warn",
      log: (
        level: "debug" | "error" | "info" | "warn",
        message: string,
        ...args: readonly unknown[]
      ) =>
        logStructuredEvent({
          event: "auth.better_auth.log",
          auth_log_arity: args.length,
          auth_log_level: level,
          auth_message: message,
        }),
    },
    plugins: [
      agentAuth(createCoffeeAgentAuthOptions({ makeAppLayer: deps.makeAppLayer })),
      passkey({
        registration: {
          afterVerification: async ({ ctx, context, user }) => {
            if (!user.id.startsWith(provisionalUserPrefix)) {
              return;
            }

            await ctx.context.internalAdapter.createUser(
              createRegisteredUser({ context, userId: user.id }),
            );
            return { userId: user.id };
          },
          requireSession: false,
          resolveUser: async ({ context }) => createProvisionalUser(getDisplayName(context)),
        },
        rpName: "Effect Coffee Shop",
        ...(origin === undefined ? {} : { origin }),
        ...(host === undefined ? {} : { rpID: host }),
      }),
    ],
    secret: getBetterAuthSecret(deps.secret),
    telemetry: {
      enabled: false,
    },
  };
}

export async function ensureAuthPersistence(deps: AuthDependencies): Promise<void> {
  if (authPersistencePromise !== undefined) {
    return authPersistencePromise;
  }

  authPersistencePromise = (async () => {
    const authOptions = buildAuthOptions({ ...deps, request: undefined });
    // Better Auth's passkey plugin types conflict with exactOptionalPropertyTypes.
    // @ts-expect-error third-party Better Auth typing bug
    const { runMigrations } = await getMigrations(authOptions);

    await runMigrations();
  })();

  return authPersistencePromise;
}

export function createAuth(deps: AuthDependencies & { readonly request: Request }) {
  const authOptions = buildAuthOptions(deps);

  // @ts-expect-error third-party Better Auth typing bug
  return betterAuth(authOptions);
}

export async function resolveActor(
  deps: AuthDependencies & {
    readonly request: Request;
    readonly staffUserIds: ReadonlySet<string>;
  },
): Promise<AppActor> {
  if ((deps.secret?.trim() ?? "") === "") {
    return anonymousActor;
  }

  const auth = createAuth(deps);
  const session = await auth.api.getSession({
    headers: deps.request.headers,
  });

  if (session?.user === undefined) {
    return anonymousActor;
  }

  return decodeResolvedActor({
    displayName: session.user.name.trim() || session.user.email,
    kind: deps.staffUserIds.has(session.user.id) ? "staff" : "customer",
    userId: session.user.id,
  });
}

import type { D1Database } from "@cloudflare/workers-types";
import { passkey } from "@better-auth/passkey";
import { getMigrations } from "better-auth/db/migration";
import { betterAuth } from "better-auth";
import * as Schema from "effect/Schema";
import { AppActorSchema, anonymousActor, type AppActor } from "#service/CurrentActor";

const syntheticEmailDomain = "users.onion.invalid";
const longEnoughDevelopmentSecret = "dev-better-auth-secret-please-change-me-0001";
const provisionalUserPrefix = "passkey-signup-";

const PasskeyRegistrationContextSchema = Schema.Struct({
  displayName: Schema.String,
});

const decodeJsonString = Schema.decodeUnknownSync(Schema.UnknownFromJsonString);
const decodePasskeyRegistrationShape = Schema.decodeUnknownSync(PasskeyRegistrationContextSchema);

const decodeResolvedActor = Schema.decodeUnknownSync(AppActorSchema);

const authBootstrapCache = new WeakMap<D1Database, Promise<void>>();

function getDisplayName(context: string | null | undefined): string {
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

function createProvisionalUser(displayName: string) {
  const userId = `${provisionalUserPrefix}${crypto.randomUUID()}`;
  return {
    displayName,
    id: userId,
    name: createSyntheticEmail(userId),
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

function buildAuthOptions(input: {
  readonly db: D1Database;
  readonly request: Request | undefined;
  readonly secret: string | undefined;
}) {
  const origin = getRequestOrigin(input.request);
  const host = getRequestHost(input.request);

  return {
    appName: "Onion Coffee Shop",
    basePath: "/api/auth",
    database: input.db,
    ...(origin === undefined ? {} : { baseURL: origin }),
    plugins: [
      passkey({
        registration: {
          afterVerification: async ({ ctx, user }) => {
            if (!user.id.startsWith(provisionalUserPrefix)) {
              return;
            }

            const displayName = getDisplayName(ctx.query?.context ?? null);
            await ctx.context.internalAdapter.createUser({
              email: createSyntheticEmail(user.id),
              id: user.id,
              name: displayName,
            });
            return { userId: user.id };
          },
          requireSession: false,
          resolveUser: async ({ context }) => createProvisionalUser(getDisplayName(context)),
        },
        rpName: "Onion Coffee Shop",
        ...(origin === undefined ? {} : { origin }),
        ...(host === undefined ? {} : { rpID: host }),
      }),
    ],
    secret: getBetterAuthSecret(input.secret),
  };
}

function parseStaffUserIds(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

async function ensureOrderOwnershipColumn(db: D1Database): Promise<void> {
  const table = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'orders'")
    .all<{ name: string }>();

  if (table.results.length === 0) {
    return;
  }

  const pragma = await db.prepare("PRAGMA table_info(orders)").all<{ name: string }>();

  if (pragma.results.some((column) => column.name === "ownerUserId")) {
    return;
  }

  await db.exec(
    [
      "ALTER TABLE orders ADD COLUMN ownerUserId TEXT NOT NULL DEFAULT '__legacy__';",
      "CREATE INDEX IF NOT EXISTS orders_owner_user_id_created_at_idx ON orders (ownerUserId, createdAt, id);",
      "CREATE INDEX IF NOT EXISTS orders_owner_user_id_status_created_at_idx ON orders (ownerUserId, status, createdAt, id);",
    ].join("\n"),
  );
}

export async function ensureCloudflareAuthPersistence(input: {
  readonly db: D1Database;
  readonly secret: string | undefined;
}): Promise<void> {
  const cached = authBootstrapCache.get(input.db);

  if (cached !== undefined) {
    return cached;
  }

  const bootstrap = (async () => {
    const authOptions = buildAuthOptions({
      db: input.db,
      request: undefined,
      secret: input.secret,
    });
    // Better Auth's passkey plugin types currently conflict with exactOptionalPropertyTypes.
    // Runtime behavior works on Cloudflare D1; keep the compatibility escape hatch here.
    // @ts-expect-error third-party Better Auth typing bug
    const { runMigrations } = await getMigrations(authOptions);

    await runMigrations();
    await ensureOrderOwnershipColumn(input.db);
  })();

  authBootstrapCache.set(input.db, bootstrap);
  return bootstrap;
}

export function createCloudflareAuth(input: {
  readonly db: D1Database;
  readonly request: Request;
  readonly secret: string | undefined;
}) {
  const authOptions = buildAuthOptions({
    db: input.db,
    request: input.request,
    secret: input.secret,
  });

  // @ts-expect-error third-party Better Auth typing bug
  return betterAuth(authOptions);
}

export async function resolveCloudflareActor(input: {
  readonly db: D1Database;
  readonly request: Request;
  readonly secret: string | undefined;
  readonly staffUserIds: string | undefined;
}): Promise<AppActor> {
  if ((input.secret?.trim() ?? "") === "") {
    return anonymousActor;
  }

  const auth = createCloudflareAuth(input);
  const session = await auth.api.getSession({
    headers: input.request.headers,
  });

  if (session?.user === undefined) {
    return anonymousActor;
  }

  const staffUserIds = parseStaffUserIds(input.staffUserIds);

  return decodeResolvedActor({
    displayName: session.user.name.trim() || session.user.email,
    kind: staffUserIds.has(session.user.id) ? "staff" : "customer",
    userId: session.user.id,
  });
}

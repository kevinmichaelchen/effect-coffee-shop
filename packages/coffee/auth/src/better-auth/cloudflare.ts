import type { D1Database } from "@cloudflare/workers-types";
import { agentAuth } from "@better-auth/agent-auth";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { createCoffeeAgentAuthOptions } from "../agent/options.ts";
import { logStructuredEvent } from "@effect-coffee-shop/backend-host/logging";
import {
  AppActorSchema,
  anonymousActor,
  type AppActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import {
  createProvisionalUser,
  createRegisteredUser,
  getDisplayName,
  provisionalUserPrefix,
} from "./users.ts";

const BetterAuthSecretSchema = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()));
const decodeResolvedActor = Schema.decodeUnknownSync(AppActorSchema);
const decodeBetterAuthSecret = Schema.decodeUnknownSync(BetterAuthSecretSchema);
const decodeTrimmedString = Schema.decodeUnknownSync(Schema.Trim);
type CoffeeAuthAppLayer = Parameters<typeof createCoffeeAgentAuthOptions>[0]["appLayer"];

const optionalRequestUrl = (request: Request | undefined): Option.Option<URL> =>
  Option.map(Option.fromUndefinedOr(request), (request) => new URL(request.url));

const getRequestOrigin = (request: Request | undefined): Option.Option<string> =>
  Option.map(optionalRequestUrl(request), (url) => url.origin);

const getRequestHost = (request: Request | undefined): Option.Option<string> =>
  Option.map(optionalRequestUrl(request), (url) => url.hostname);

const whenSome = <A, B extends object>(
  option: Option.Option<A>,
  onSome: (value: A) => B,
): B | object =>
  Option.match(option, {
    onNone: () => ({}),
    onSome,
  });

function buildAuthOptions(input: {
  readonly appLayer: CoffeeAuthAppLayer;
  readonly db: D1Database;
  readonly request: Request | undefined;
  readonly secret: string;
}) {
  const origin = getRequestOrigin(input.request);
  const host = getRequestHost(input.request);

  return {
    appName: "Effect Coffee Shop",
    basePath: "/api/auth",
    database: input.db,
    ...whenSome(origin, (baseURL) => ({ baseURL })),
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
      agentAuth(createCoffeeAgentAuthOptions({ appLayer: input.appLayer })),
      passkey({
        registration: {
          afterVerification: async ({ ctx, context, user }) => {
            return Option.match(
              Option.some(user.id).pipe(
                Option.filter((userId) => userId.startsWith(provisionalUserPrefix)),
              ),
              {
                onNone: () => undefined,
                onSome: async (userId) => {
                  await ctx.context.internalAdapter.createUser(
                    createRegisteredUser({ context, userId }),
                  );
                  return { userId };
                },
              },
            );
          },
          requireSession: false,
          resolveUser: async ({ context }) => createProvisionalUser(getDisplayName(context)),
        },
        rpName: "Effect Coffee Shop",
        ...whenSome(origin, (origin) => ({ origin })),
        ...whenSome(host, (rpID) => ({ rpID })),
      }),
    ],
    secret: input.secret,
    telemetry: {
      enabled: false,
    },
  };
}

export async function ensureCloudflareAuthPersistence(_input: {
  readonly db: D1Database;
}): Promise<void> {}

export function createCloudflareAuth(input: {
  readonly appLayer: CoffeeAuthAppLayer;
  readonly db: D1Database;
  readonly request: Request;
  readonly secret: string;
}) {
  const secret = decodeBetterAuthSecret(input.secret);
  const authOptions = buildAuthOptions({
    appLayer: input.appLayer,
    db: input.db,
    request: input.request,
    secret,
  });

  // @ts-expect-error third-party Better Auth typing bug
  return betterAuth(authOptions);
}

export async function resolveCloudflareActor(input: {
  readonly appLayer: CoffeeAuthAppLayer;
  readonly db: D1Database;
  readonly request: Request;
  readonly secret: string | undefined;
  readonly staffUserIds: ReadonlySet<string>;
}): Promise<AppActor> {
  return Option.match(
    Option.some(decodeTrimmedString(input.secret ?? "")).pipe(
      Option.filter((secret) => secret !== ""),
    ),
    {
      onNone: async () => anonymousActor,
      onSome: async (secret) => {
        const auth = createCloudflareAuth({
          appLayer: input.appLayer,
          db: input.db,
          request: input.request,
          secret,
        });
        const session = await auth.api.getSession({
          headers: input.request.headers,
        });

        return Option.match(Option.fromNullishOr(session?.user), {
          onNone: () => anonymousActor,
          onSome: (user) =>
            decodeResolvedActor({
              displayName: decodeTrimmedString(user.name) || user.email,
              kind: Option.match(
                Option.some(user.id).pipe(
                  Option.filter((userId) => input.staffUserIds.has(userId)),
                ),
                {
                  onNone: () => "customer",
                  onSome: () => "staff",
                },
              ),
              userId: user.id,
            }),
        });
      },
    },
  );
}

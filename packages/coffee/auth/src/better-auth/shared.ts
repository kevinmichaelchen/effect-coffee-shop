import { agentAuth } from "@better-auth/agent-auth";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { createCoffeeAgentAuthOptions } from "../agent/options.ts";
import { logStructuredEvent } from "@effect-coffee-shop/backend-host/logging";
import { runHostEffect } from "@effect-coffee-shop/backend-host/observability";
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
type BetterAuthOptions = Parameters<typeof betterAuth>[0];
type BetterAuthDatabase = BetterAuthOptions["database"];
export type CoffeeAuthDatabase = BetterAuthDatabase;

export interface CoffeeAuthInput {
  readonly appLayer: CoffeeAuthAppLayer;
  readonly database: BetterAuthDatabase;
  readonly request: Request;
  readonly secret: string;
}

export interface CoffeeActorResolutionInput {
  readonly appLayer: CoffeeAuthAppLayer;
  readonly database: BetterAuthDatabase;
  readonly request: Request;
  readonly secret: string | undefined;
  readonly staffUserIds: ReadonlySet<string>;
}

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

function buildCoffeeAuthOptions(input: CoffeeAuthInput) {
  const origin = getRequestOrigin(input.request);
  const host = getRequestHost(input.request);

  return {
    appName: "Effect Coffee Shop",
    basePath: "/api/auth",
    database: input.database,
    ...whenSome(origin, (baseURL) => ({ baseURL })),
    logger: {
      level: "warn",
      log: (
        level: "debug" | "error" | "info" | "warn",
        message: string,
        ...args: readonly unknown[]
      ) =>
        void runHostEffect(
          logStructuredEvent({
            event: "auth.better_auth.log",
            auth_log_arity: args.length,
            auth_log_level: level,
            auth_message: message,
          }),
        ),
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

export function createCoffeeAuth(input: CoffeeAuthInput) {
  const secret = decodeBetterAuthSecret(input.secret);
  const authOptions = buildCoffeeAuthOptions({
    appLayer: input.appLayer,
    database: input.database,
    request: input.request,
    secret,
  });

  // @ts-expect-error third-party Better Auth typing bug
  return betterAuth(authOptions);
}

export async function resolveCoffeeActor(input: CoffeeActorResolutionInput): Promise<AppActor> {
  return Option.match(
    Option.some(decodeTrimmedString(input.secret ?? "")).pipe(
      Option.filter((secret) => secret !== ""),
    ),
    {
      onNone: async () => anonymousActor,
      onSome: async (secret) => {
        const auth = createCoffeeAuth({
          appLayer: input.appLayer,
          database: input.database,
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

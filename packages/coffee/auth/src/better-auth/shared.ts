import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { logStructuredEvent } from "@effect-coffee-shop/http-routing/logging";
import { runHttpEffect } from "@effect-coffee-shop/http-routing/observability";
import { type AppActor, anonymousActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { actorFromIdentity } from "../yielded/identity.ts";
import { identityFromVerifiedBetterAuthUser } from "../yielded/better-auth.ts";
import {
  createProvisionalUser,
  createRegisteredUser,
  getDisplayName,
  provisionalUserPrefix,
} from "./users.ts";

const BetterAuthSecret = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()));
const decodeBetterAuthSecret = Schema.decodeUnknownSync(BetterAuthSecret);
const decodeTrimmedString = Schema.decodeUnknownSync(Schema.Trim);
export type BetterAuthOptions = Parameters<typeof betterAuth>[0];
export type BetterAuthDatabase = BetterAuthOptions["database"];
export type CoffeeAuthDatabase = BetterAuthDatabase;

export interface CoffeeAuthInput {
  readonly database: BetterAuthDatabase;
  readonly request: Request;
  readonly secret: string;
}

export interface CoffeeActorResolutionInput {
  readonly database: BetterAuthDatabase;
  readonly request: Request;
  // oxlint-disable-next-line effect/prefer-option-over-null -- Better Auth SDK represents absent secrets and registration context with nullish values.
  readonly secret: string | undefined;
  readonly staffUserIds: ReadonlySet<string>;
}

function buildCoffeeAuthOptions(input: CoffeeAuthInput): BetterAuthOptions {
  const requestUrl = new URL(input.request.url);

  return {
    appName: "Effect Coffee Shop",
    baseURL: requestUrl.origin,
    basePath: "/api/auth",
    database: input.database,
    logger: {
      level: "warn",
      log: (
        level: "debug" | "error" | "info" | "warn",
        message: string,
        ...args: readonly unknown[]
      ) =>
        void runHttpEffect(
          logStructuredEvent({
            event: "auth.better_auth.log",
            auth_log_arity: args.length,
            auth_log_level: level,
            auth_message: message,
          }),
        ),
    },
    plugins: [
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
                    { method: "passkey" },
                  );
                  return { userId };
                },
              },
            );
          },
          requireSession: false,
          resolveUser: async ({ context }) => createProvisionalUser(getDisplayName(context)),
        },
        origin: requestUrl.origin,
        rpName: "Effect Coffee Shop",
        rpID: requestUrl.hostname,
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
    database: input.database,
    request: input.request,
    secret,
  });

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
            runHttpEffect(
              identityFromVerifiedBetterAuthUser(user).pipe(
                Effect.flatMap((identity) => actorFromIdentity(identity, input.staffUserIds)),
              ),
            ),
        });
      },
    },
  );
}

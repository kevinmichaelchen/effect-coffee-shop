import type { D1Database } from "@cloudflare/workers-types";
import { agentAuth } from "@better-auth/agent-auth";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import * as Layer from "effect/Layer";
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

const longEnoughDevelopmentSecret = "dev-better-auth-secret-please-change-me-0001";

const decodeResolvedActor = Schema.decodeUnknownSync(AppActorSchema);

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
  readonly appLayer: Layer.Layer<never, any, any>;
  readonly db: D1Database;
  readonly request: Request | undefined;
  readonly secret: string | undefined;
}) {
  const origin = getRequestOrigin(input.request);
  const host = getRequestHost(input.request);

  return {
    appName: "Effect Coffee Shop",
    basePath: "/api/auth",
    database: input.db,
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
      agentAuth(createCoffeeAgentAuthOptions({ appLayer: input.appLayer })),
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
    secret: getBetterAuthSecret(input.secret),
    telemetry: {
      enabled: false,
    },
  };
}

export async function ensureCloudflareAuthPersistence(_input: {
  readonly db: D1Database;
  readonly secret: string | undefined;
}): Promise<void> {}

export function createCloudflareAuth(input: {
  readonly appLayer: Layer.Layer<never, any, any>;
  readonly db: D1Database;
  readonly request: Request;
  readonly secret: string | undefined;
}) {
  const authOptions = buildAuthOptions({
    appLayer: input.appLayer,
    db: input.db,
    request: input.request,
    secret: input.secret,
  });

  // @ts-expect-error third-party Better Auth typing bug
  return betterAuth(authOptions);
}

export async function resolveCloudflareActor(input: {
  readonly appLayer: Layer.Layer<never, any, any>;
  readonly db: D1Database;
  readonly request: Request;
  readonly secret: string | undefined;
  readonly staffUserIds: ReadonlySet<string>;
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

  return decodeResolvedActor({
    displayName: session.user.name.trim() || session.user.email,
    kind: input.staffUserIds.has(session.user.id) ? "staff" : "customer",
    userId: session.user.id,
  });
}

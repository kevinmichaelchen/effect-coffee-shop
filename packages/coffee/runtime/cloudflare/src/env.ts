/**
 * Decodes Cloudflare Worker bindings and scalar environment configuration.
 *
 * @module
 */
import type {
  AiTextGenerationInput,
  AiTextGenerationOutput,
  D1Database,
} from "@cloudflare/workers-types";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import {
  optionalTrimmedString,
  parseCsvSet,
  trimOptionalRedactedString,
} from "@effect-coffee-shop/coffee-runtime-shared/env";
export { revealOptionalSecret, revealSecret } from "@effect-coffee-shop/coffee-runtime-shared/env";

export type AssetFetcher = { fetch(request: Request): Promise<Response> };
export type SecretValueBinding = { get(): Promise<string> };

export interface WorkersAiBinding {
  run(
    model: string,
    inputs: AiTextGenerationInput,
    options?: object,
  ): Promise<AiTextGenerationOutput>;
}

export const cloudflareBindingNames = {
  ai: "AI",
  assets: "ASSETS",
  db: "DB",
} as const;

export const cloudflareEnvNames = {
  aiGatewayId: "AI_GATEWAY_ID",
  betterAuthSecret: "BETTER_AUTH_SECRET",
  coffeeAssistantModel: "COFFEE_ASSISTANT_MODEL",
  coffeeStaffUserIds: "COFFEE_STAFF_USER_IDS",
} as const;

export const cloudflareAssistantGatewayId = "effect-v4-onion-assistant";

export interface CloudflareWorkerEnv {
  AI?: WorkersAiBinding;
  AI_GATEWAY_ID?: string;
  BETTER_AUTH_SECRET?: SecretValueBinding | string;
  COFFEE_ASSISTANT_MODEL?: string;
  COFFEE_STAFF_USER_IDS?: string;
  DB: D1Database;
  ASSETS?: AssetFetcher;
}

class CloudflareSecretBindingError extends Schema.TaggedErrorClass<CloudflareSecretBindingError>()(
  "CloudflareSecretBindingError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export interface CloudflareRuntime {
  readonly bindings: {
    readonly ai: Option.Option<WorkersAiBinding>;
    readonly assets: Option.Option<AssetFetcher>;
    readonly db: D1Database;
  };
  readonly config: {
    readonly aiGatewayId: Option.Option<string>;
    readonly assistantModel: Option.Option<string>;
    readonly betterAuthSecret: Option.Option<Redacted.Redacted<string>>;
    readonly staffUserIds: ReadonlySet<string>;
  };
}

const cloudflareConfig = Config.all({
  aiGatewayId: Config.option(Config.string("aiGatewayId")),
  coffeeAssistantModel: Config.option(Config.string("coffeeAssistantModel")),
  coffeeStaffUserIds: Config.string("coffeeStaffUserIds").pipe(Config.withDefault("")),
});

const trimBetterAuthSecret = (secret: string): Option.Option<Redacted.Redacted<string>> =>
  trimOptionalRedactedString(
    Option.some(Redacted.make(secret, { label: cloudflareEnvNames.betterAuthSecret })),
    cloudflareEnvNames.betterAuthSecret,
  );

export const readCloudflareRuntime = Effect.fn("Cloudflare.readRuntime")(function* (
  env: CloudflareWorkerEnv,
) {
  const decodedConfig = yield* cloudflareConfig.parse(
    ConfigProvider.fromUnknown(env).pipe(ConfigProvider.constantCase),
  );
  const betterAuthSecret = yield* Option.match(
    Option.fromNullishOr(env[cloudflareEnvNames.betterAuthSecret]),
    {
      onNone: () => Effect.succeed(Option.none()),
      onSome: (binding) =>
        Match.value(binding).pipe(
          Match.when(P.isString, (secret) => Effect.succeed(trimBetterAuthSecret(secret))),
          Match.orElse((secretBinding) =>
            Effect.tryPromise({
              try: async () => secretBinding.get(),
              catch: (cause) =>
                new CloudflareSecretBindingError({
                  message: "Unable to read BETTER_AUTH_SECRET from Cloudflare Secrets Store.",
                  cause,
                }),
            }).pipe(Effect.map(trimBetterAuthSecret)),
          ),
        ),
    },
  );

  return {
    bindings: {
      ai: Option.fromNullishOr(env[cloudflareBindingNames.ai]),
      assets: Option.fromNullishOr(env[cloudflareBindingNames.assets]),
      db: env[cloudflareBindingNames.db],
    },
    config: {
      aiGatewayId: Option.flatMap(decodedConfig.aiGatewayId, optionalTrimmedString),
      assistantModel: Option.flatMap(decodedConfig.coffeeAssistantModel, optionalTrimmedString),
      betterAuthSecret,
      staffUserIds: parseCsvSet(decodedConfig.coffeeStaffUserIds),
    },
  } satisfies CloudflareRuntime;
});

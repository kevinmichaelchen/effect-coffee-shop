/**
 * Decodes AWS Lambda environment configuration for the Coffee backend.
 *
 * @module
 */
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import {
  getAssistantAiConfigFromEnv,
  type AssistantAiConfig,
} from "@effect-coffee-shop/coffee-assistant/providers";
import {
  parseCsvSet,
  trimOptionalRedactedString,
} from "@effect-coffee-shop/coffee-runtime-shared/env";
export { revealOptionalSecret, revealSecret } from "@effect-coffee-shop/coffee-runtime-shared/env";

export const awsEnvNames = {
  assistantWorkersAiAccountId: "CLOUDFLARE_ACCOUNT_ID",
  assistantWorkersAiApiToken: "CLOUDFLARE_API_TOKEN",
  betterAuthSecret: "BETTER_AUTH_SECRET",
  coffeeAssistantModel: "COFFEE_ASSISTANT_MODEL",
  coffeeAssistantOllamaUrl: "COFFEE_ASSISTANT_OLLAMA_URL",
  coffeeAssistantProvider: "COFFEE_ASSISTANT_PROVIDER",
  coffeePostgresUrl: "COFFEE_POSTGRES_URL",
  coffeeStaffUserIds: "COFFEE_STAFF_USER_IDS",
  ollamaHost: "OLLAMA_HOST",
} as const;

export interface AwsLambdaEnv {
  readonly BETTER_AUTH_SECRET?: string;
  readonly CLOUDFLARE_ACCOUNT_ID?: string;
  readonly CLOUDFLARE_API_TOKEN?: string;
  readonly COFFEE_ASSISTANT_MODEL?: string;
  readonly COFFEE_ASSISTANT_OLLAMA_URL?: string;
  readonly COFFEE_ASSISTANT_PROVIDER?: string;
  readonly COFFEE_POSTGRES_URL?: string;
  readonly COFFEE_STAFF_USER_IDS?: string;
  readonly OLLAMA_HOST?: string;
}

export interface AwsRuntime {
  readonly config: {
    readonly assistantAi: Option.Option<AssistantAiConfig>;
    readonly betterAuthSecret: Option.Option<Redacted.Redacted<string>>;
    readonly staffUserIds: ReadonlySet<string>;
  };
}

const awsRuntimeConfig = Config.all({
  assistantWorkersAiAccountId: Config.option(Config.string("cloudflareAccountId")),
  assistantWorkersAiApiToken: Config.option(Config.redacted("cloudflareApiToken")),
  betterAuthSecret: Config.option(Config.redacted("betterAuthSecret")),
  coffeeAssistantModel: Config.option(Config.string("coffeeAssistantModel")),
  coffeeAssistantOllamaUrl: Config.option(Config.string("coffeeAssistantOllamaUrl")),
  coffeeAssistantProvider: Config.option(Config.string("coffeeAssistantProvider")),
  coffeeStaffUserIds: Config.string("coffeeStaffUserIds").pipe(Config.withDefault("")),
  ollamaHost: Config.option(Config.string("ollamaHost")),
});

interface AwsRuntimeConfig {
  readonly assistantWorkersAiAccountId: Option.Option<string>;
  readonly assistantWorkersAiApiToken: Option.Option<Redacted.Redacted<string>>;
  readonly betterAuthSecret: Option.Option<Redacted.Redacted<string>>;
  readonly coffeeAssistantModel: Option.Option<string>;
  readonly coffeeAssistantOllamaUrl: Option.Option<string>;
  readonly coffeeAssistantProvider: Option.Option<string>;
  readonly coffeeStaffUserIds: string;
  readonly ollamaHost: Option.Option<string>;
}

const optionalStringValue = (value: Option.Option<string>): string | undefined =>
  Option.getOrUndefined(value);

const optionalRedactedValue = (
  value: Option.Option<Redacted.Redacted<string>>,
): string | undefined => Option.getOrUndefined(Option.map(value, Redacted.value));

const toAssistantEnv = (env: AwsRuntimeConfig): Record<string, string | undefined> => ({
  [awsEnvNames.assistantWorkersAiAccountId]: optionalStringValue(env.assistantWorkersAiAccountId),
  [awsEnvNames.assistantWorkersAiApiToken]: optionalRedactedValue(env.assistantWorkersAiApiToken),
  [awsEnvNames.coffeeAssistantModel]: optionalStringValue(env.coffeeAssistantModel),
  [awsEnvNames.coffeeAssistantOllamaUrl]: optionalStringValue(env.coffeeAssistantOllamaUrl),
  [awsEnvNames.coffeeAssistantProvider]: optionalStringValue(env.coffeeAssistantProvider),
  [awsEnvNames.ollamaHost]: optionalStringValue(env.ollamaHost),
});

export const readAwsRuntime = (env: unknown): AwsRuntime => {
  const decodedConfig = Effect.runSync(
    awsRuntimeConfig.parse(ConfigProvider.fromUnknown(env).pipe(ConfigProvider.constantCase)),
  );
  const assistantEnv = toAssistantEnv(decodedConfig);
  const assistantAi = getAssistantAiConfigFromEnv(assistantEnv);

  return {
    config: {
      assistantAi: Option.fromNullishOr(assistantAi),
      betterAuthSecret: trimOptionalRedactedString(
        decodedConfig.betterAuthSecret,
        awsEnvNames.betterAuthSecret,
      ),
      staffUserIds: parseCsvSet(decodedConfig.coffeeStaffUserIds),
    },
  };
};

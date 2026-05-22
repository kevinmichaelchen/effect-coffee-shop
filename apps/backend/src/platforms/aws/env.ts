/**
 * Decodes AWS Lambda environment configuration for the Coffee backend.
 *
 * @module
 */
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import {
  getAssistantAiConfigFromEnv,
  type AssistantAiConfig,
} from "@effect-coffee-shop/coffee-assistant/providers";
import { optionalTrimmedRedactedString, parseCsvSet } from "../env.ts";
export { revealOptionalSecret, revealSecret } from "../env.ts";

export const awsEnvNames = {
  betterAuthSecret: "BETTER_AUTH_SECRET",
  cloudflareAccountId: "CLOUDFLARE_ACCOUNT_ID",
  cloudflareApiToken: "CLOUDFLARE_API_TOKEN",
  coffeeAssistantModel: "COFFEE_ASSISTANT_MODEL",
  coffeeAssistantOllamaUrl: "COFFEE_ASSISTANT_OLLAMA_URL",
  coffeeAssistantProvider: "COFFEE_ASSISTANT_PROVIDER",
  coffeePostgresUrl: "COFFEE_POSTGRES_URL",
  coffeeStaffUserIds: "COFFEE_STAFF_USER_IDS",
  ollamaHost: "OLLAMA_HOST",
} as const;

const AwsLambdaEnvSchema = Schema.Struct({
  BETTER_AUTH_SECRET: Schema.optionalKey(Schema.String),
  CLOUDFLARE_ACCOUNT_ID: Schema.optionalKey(Schema.String),
  CLOUDFLARE_API_TOKEN: Schema.optionalKey(Schema.String),
  COFFEE_ASSISTANT_MODEL: Schema.optionalKey(Schema.String),
  COFFEE_ASSISTANT_OLLAMA_URL: Schema.optionalKey(Schema.String),
  COFFEE_ASSISTANT_PROVIDER: Schema.optionalKey(Schema.String),
  COFFEE_POSTGRES_URL: Schema.optionalKey(Schema.String),
  COFFEE_STAFF_USER_IDS: Schema.optionalKey(Schema.String),
  OLLAMA_HOST: Schema.optionalKey(Schema.String),
});

export type AwsLambdaEnv = Schema.Schema.Type<typeof AwsLambdaEnvSchema>;

export interface AwsRuntime {
  readonly config: {
    readonly assistantAi: Option.Option<AssistantAiConfig>;
    readonly betterAuthSecret: Option.Option<Redacted.Redacted<string>>;
    readonly staffUserIds: ReadonlySet<string>;
  };
}

const decodeAwsLambdaEnv = Schema.decodeUnknownSync(AwsLambdaEnvSchema);

const toAssistantEnv = (env: AwsLambdaEnv): Record<string, string | undefined> => ({
  [awsEnvNames.cloudflareAccountId]: env.CLOUDFLARE_ACCOUNT_ID,
  [awsEnvNames.cloudflareApiToken]: env.CLOUDFLARE_API_TOKEN,
  [awsEnvNames.coffeeAssistantModel]: env.COFFEE_ASSISTANT_MODEL,
  [awsEnvNames.coffeeAssistantOllamaUrl]: env.COFFEE_ASSISTANT_OLLAMA_URL,
  [awsEnvNames.coffeeAssistantProvider]: env.COFFEE_ASSISTANT_PROVIDER,
  [awsEnvNames.ollamaHost]: env.OLLAMA_HOST,
});

export const readAwsRuntime = (env: unknown): AwsRuntime => {
  const decodedEnv = decodeAwsLambdaEnv(env);
  const assistantEnv = toAssistantEnv(decodedEnv);
  const assistantAi = getAssistantAiConfigFromEnv(assistantEnv);

  return {
    config: {
      assistantAi: Option.fromNullishOr(assistantAi),
      betterAuthSecret: optionalTrimmedRedactedString(
        decodedEnv.BETTER_AUTH_SECRET,
        awsEnvNames.betterAuthSecret,
      ),
      staffUserIds: parseCsvSet(decodedEnv.COFFEE_STAFF_USER_IDS),
    },
  };
};

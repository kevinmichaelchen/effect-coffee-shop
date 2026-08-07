/**
 * Alchemy v2 AWS Lambda Function entrypoint for the Coffee backend.
 *
 * @module
 */
import * as Alchemy from "alchemy";
import * as AWS from "alchemy/AWS";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { routeAwsRequest } from "./router.ts";
import { awsEnvNames, type AwsLambdaEnv } from "./env.ts";

const optionalVariableConfig = (name: string) => Config.string(name).pipe(Config.withDefault(""));

const optionalSecretConfig = (name: string) =>
  Config.redacted(name).pipe(Config.withDefault(Redacted.make("", { label: name })));

const requiredSecretConfig = (name: string) => Config.redacted(name);

const configuredBetterAuthSecret = Config.redacted(awsEnvNames.betterAuthSecret).pipe(
  Config.option,
  Config.map(Option.getOrUndefined),
  Effect.orDie,
);

const runtimeEnvConfig = Config.all({
  assistantWorkersAiAccountId: optionalVariableConfig(awsEnvNames.assistantWorkersAiAccountId),
  assistantWorkersAiApiToken: optionalSecretConfig(awsEnvNames.assistantWorkersAiApiToken),
  betterAuthSecret: optionalSecretConfig(awsEnvNames.betterAuthSecret),
  coffeeAssistantModel: optionalVariableConfig(awsEnvNames.coffeeAssistantModel),
  coffeeAssistantOllamaUrl: optionalVariableConfig(awsEnvNames.coffeeAssistantOllamaUrl),
  coffeeAssistantProvider: optionalVariableConfig(awsEnvNames.coffeeAssistantProvider),
  coffeePostgresUrl: requiredSecretConfig(awsEnvNames.coffeePostgresUrl),
  coffeeStaffUserIds: optionalVariableConfig(awsEnvNames.coffeeStaffUserIds),
  ollamaHost: optionalVariableConfig(awsEnvNames.ollamaHost),
}).pipe(
  Config.map((env): AwsLambdaEnv => ({
    BETTER_AUTH_SECRET: Redacted.value(env.betterAuthSecret),
    CLOUDFLARE_ACCOUNT_ID: env.assistantWorkersAiAccountId,
    CLOUDFLARE_API_TOKEN: Redacted.value(env.assistantWorkersAiApiToken),
    COFFEE_ASSISTANT_MODEL: env.coffeeAssistantModel,
    COFFEE_ASSISTANT_OLLAMA_URL: env.coffeeAssistantOllamaUrl,
    COFFEE_ASSISTANT_PROVIDER: env.coffeeAssistantProvider,
    COFFEE_POSTGRES_URL: Redacted.value(env.coffeePostgresUrl),
    COFFEE_STAFF_USER_IDS: env.coffeeStaffUserIds,
    OLLAMA_HOST: env.ollamaHost,
  })),
);

const runtimeEnv = runtimeEnvConfig.pipe(Effect.orDie);

export default class CoffeeApi extends AWS.Lambda.Function<CoffeeApi>()(
  "CoffeeApi",
  Effect.gen(function* () {
    const generatedBetterAuthSecret = yield* Alchemy.makeRandom("BetterAuthSecret", {
      bytes: 32,
    });
    const betterAuthSecret = (yield* configuredBetterAuthSecret) ?? generatedBetterAuthSecret;

    return {
      env: {
        [awsEnvNames.assistantWorkersAiAccountId]: yield* optionalVariableConfig(
          awsEnvNames.assistantWorkersAiAccountId,
        ).pipe(Effect.orDie),
        [awsEnvNames.assistantWorkersAiApiToken]: yield* optionalSecretConfig(
          awsEnvNames.assistantWorkersAiApiToken,
        ).pipe(Effect.orDie),
        [awsEnvNames.betterAuthSecret]: betterAuthSecret,
        [awsEnvNames.coffeeAssistantModel]: yield* optionalVariableConfig(
          awsEnvNames.coffeeAssistantModel,
        ).pipe(Effect.orDie),
        [awsEnvNames.coffeeAssistantOllamaUrl]: yield* optionalVariableConfig(
          awsEnvNames.coffeeAssistantOllamaUrl,
        ).pipe(Effect.orDie),
        [awsEnvNames.coffeeAssistantProvider]: yield* optionalVariableConfig(
          awsEnvNames.coffeeAssistantProvider,
        ).pipe(Effect.orDie),
        [awsEnvNames.coffeePostgresUrl]: yield* requiredSecretConfig(
          awsEnvNames.coffeePostgresUrl,
        ).pipe(Effect.orDie),
        [awsEnvNames.coffeeStaffUserIds]: yield* optionalVariableConfig(
          awsEnvNames.coffeeStaffUserIds,
        ).pipe(Effect.orDie),
        [awsEnvNames.ollamaHost]: yield* optionalVariableConfig(awsEnvNames.ollamaHost).pipe(
          Effect.orDie,
        ),
      },
      main: import.meta.filename,
      runtime: "nodejs24.x",
      url: true,
    };
  }),
  Effect.succeed({
    fetch: Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const webRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
      const env = yield* runtimeEnv;
      const response = yield* routeAwsRequest(webRequest, env).pipe(Effect.orDie);

      return HttpServerResponse.fromWeb(response);
    }),
  }),
) {}

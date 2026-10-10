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
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { HttpObservabilityLive } from "@effect-coffee-shop/http-routing/observability";
import { withHttpWideEvent } from "@effect-coffee-shop/http-routing/logging";
import { toLambdaHttpResponse } from "./http-response.ts";
import { routeAwsRequest } from "./router.ts";
import { awsEnvNames, type AwsLambdaEnv } from "./env.ts";

const optionalVariableConfig = (name: string) => Config.String(name).pipe(Config.withDefault(""));

const optionalSecretConfig = (name: string) =>
  Config.Redacted(name).pipe(Config.withDefault(Redacted.make("", { label: name })));

const requiredSecretConfig = (name: string) => Config.Redacted(name);

const configuredAuthSecret = Config.Redacted(awsEnvNames.authSecret).pipe(
  Config.option,
  Config.map(Option.getOrUndefined),
  Effect.orDie,
);

const runtimeEnvConfig = Config.all({
  appOrigin: Config.String(awsEnvNames.appOrigin),
  mcpSigningKey: Config.Redacted(awsEnvNames.mcpSigningKey),
  mcpClients: optionalVariableConfig(awsEnvNames.mcpClients),
  authSecret: optionalSecretConfig(awsEnvNames.authSecret),
  coffeePostgresUrl: requiredSecretConfig(awsEnvNames.coffeePostgresUrl),
  coffeeStaffUserIds: optionalVariableConfig(awsEnvNames.coffeeStaffUserIds),
}).pipe(
  Config.map((env): AwsLambdaEnv => ({
    APP_ORIGIN: env.appOrigin,
    MCP_SIGNING_KEY: Redacted.value(env.mcpSigningKey),
    MCP_CLIENTS: env.mcpClients || "[]",
    AUTH_SECRET: Redacted.value(env.authSecret),
    COFFEE_POSTGRES_URL: Redacted.value(env.coffeePostgresUrl),
    COFFEE_STAFF_USER_IDS: env.coffeeStaffUserIds,
  })),
);

const runtimeEnv = runtimeEnvConfig.pipe(Effect.orDie);

/** The request effect registered with Alchemy, including conversion and configuration. */
export const lambdaFetch = Effect.fn("CoffeeApi.fetch")(
  function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const requestId = crypto.randomUUID();
    return yield* Effect.gen(function* () {
      const webRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
      const env = yield* runtimeEnv;
      const response = yield* routeAwsRequest(webRequest, env);
      return HttpServerResponse.fromWeb(response);
    }).pipe(
      withHttpWideEvent({ method: request.method, requestId }),
      Effect.orDie,
      toLambdaHttpResponse,
      Effect.map(HttpServerResponse.setHeader("x-request-id", requestId)),
    );
  },
  Effect.provide(HttpObservabilityLive),
  Effect.orDie,
);

export default class CoffeeApi extends AWS.Lambda.Function<CoffeeApi>()(
  "CoffeeApi",
  Effect.gen(function* () {
    const generatedAuthSecret = yield* Alchemy.makeRandom("AuthSecret", {
      bytes: 32,
    });
    const authSecret = (yield* configuredAuthSecret) ?? generatedAuthSecret;

    return {
      env: {
        [awsEnvNames.appOrigin]: yield* Config.String(awsEnvNames.appOrigin).pipe(Effect.orDie),
        [awsEnvNames.mcpSigningKey]: yield* Config.Redacted(awsEnvNames.mcpSigningKey).pipe(
          Effect.orDie,
        ),
        [awsEnvNames.mcpClients]: yield* Config.String(awsEnvNames.mcpClients).pipe(
          Config.withDefault("[]"),
          Effect.orDie,
        ),
        [awsEnvNames.authSecret]: authSecret,
        [awsEnvNames.coffeePostgresUrl]: yield* requiredSecretConfig(
          awsEnvNames.coffeePostgresUrl,
        ).pipe(Effect.orDie),
        [awsEnvNames.coffeeStaffUserIds]: yield* optionalVariableConfig(
          awsEnvNames.coffeeStaffUserIds,
        ).pipe(Effect.orDie),
      },
      main: import.meta.filename,
      runtime: "nodejs24.x",
      url: true,
    };
  }),
  Effect.succeed({ fetch: lambdaFetch() }),
) {}

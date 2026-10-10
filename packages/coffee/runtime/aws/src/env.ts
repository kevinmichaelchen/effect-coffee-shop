import { readAuthConfig } from "@effect-coffee-shop/coffee-auth/config";
import type { AuthServerConfig } from "@effect-coffee-shop/coffee-auth/server";
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
  parseCsvSet,
  trimOptionalRedactedString,
} from "@effect-coffee-shop/coffee-runtime-shared/env";
export { revealOptionalSecret, revealSecret } from "@effect-coffee-shop/coffee-runtime-shared/env";

export const awsEnvNames = {
  appOrigin: "APP_ORIGIN",
  mcpSigningKey: "MCP_SIGNING_KEY",
  mcpClients: "MCP_CLIENTS",
  authSecret: "AUTH_SECRET",
  coffeePostgresUrl: "COFFEE_POSTGRES_URL",
  coffeeStaffUserIds: "COFFEE_STAFF_USER_IDS",
} as const;

export interface AwsLambdaEnv {
  readonly APP_ORIGIN?: string;
  readonly MCP_SIGNING_KEY?: string;
  readonly MCP_CLIENTS?: string;
  readonly AUTH_SECRET?: string;
  readonly COFFEE_POSTGRES_URL?: string;
  readonly COFFEE_STAFF_USER_IDS?: string;
}

export interface AwsRuntime {
  readonly config: {
    readonly auth: Option.Option<AuthServerConfig>;
    readonly authSecret: Option.Option<Redacted.Redacted<string>>;
    readonly staffUserIds: ReadonlySet<string>;
  };
}

const awsRuntimeConfig = Config.all({
  authSecret: Config.option(Config.Redacted("authSecret")),
  coffeeStaffUserIds: Config.String("coffeeStaffUserIds").pipe(Config.withDefault("")),
});

// oxlint-disable-next-line effect/no-unknown-parameters -- AWS environment boundary forwards unknown input to the Config decoder.
export const readAwsRuntime = (env: unknown): AwsRuntime => {
  // oxlint-disable-next-line effect/effect-run-in-body -- Synchronous AWS configuration boundary; Config validates input before constructing the runtime.
  const decodedConfig = Effect.runSync(
    awsRuntimeConfig.parse(ConfigProvider.fromUnknown(env).pipe(ConfigProvider.constantCase)),
  );

  return {
    config: {
      // oxlint-disable-next-line effect/effect-run-in-body -- Synchronous configuration boundary.
      auth: Effect.runSync(
        readAuthConfig(
          trimOptionalRedactedString(decodedConfig.authSecret, awsEnvNames.authSecret),
          parseCsvSet(decodedConfig.coffeeStaffUserIds),
        ).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))),
      ),
      authSecret: trimOptionalRedactedString(decodedConfig.authSecret, awsEnvNames.authSecret),
      staffUserIds: parseCsvSet(decodedConfig.coffeeStaffUserIds),
    },
  };
};

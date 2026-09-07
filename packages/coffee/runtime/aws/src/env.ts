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
  betterAuthSecret: "BETTER_AUTH_SECRET",
  coffeePostgresUrl: "COFFEE_POSTGRES_URL",
  coffeeStaffUserIds: "COFFEE_STAFF_USER_IDS",
} as const;

export interface AwsLambdaEnv {
  readonly BETTER_AUTH_SECRET?: string;
  readonly COFFEE_POSTGRES_URL?: string;
  readonly COFFEE_STAFF_USER_IDS?: string;
}

export interface AwsRuntime {
  readonly config: {
    readonly betterAuthSecret: Option.Option<Redacted.Redacted<string>>;
    readonly staffUserIds: ReadonlySet<string>;
  };
}

const awsRuntimeConfig = Config.all({
  betterAuthSecret: Config.option(Config.redacted("betterAuthSecret")),
  coffeeStaffUserIds: Config.string("coffeeStaffUserIds").pipe(Config.withDefault("")),
});

// oxlint-disable-next-line effect/no-unknown-parameters -- AWS environment boundary forwards unknown input to the Config decoder.
export const readAwsRuntime = (env: unknown): AwsRuntime => {
  // oxlint-disable-next-line effect/effect-run-in-body -- Synchronous AWS configuration boundary; Config validates input before constructing the runtime.
  const decodedConfig = Effect.runSync(
    awsRuntimeConfig.parse(ConfigProvider.fromUnknown(env).pipe(ConfigProvider.constantCase)),
  );

  return {
    config: {
      betterAuthSecret: trimOptionalRedactedString(
        decodedConfig.betterAuthSecret,
        awsEnvNames.betterAuthSecret,
      ),
      staffUserIds: parseCsvSet(decodedConfig.coffeeStaffUserIds),
    },
  };
};

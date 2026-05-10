import type {
  AiTextGenerationInput,
  AiTextGenerationOutput,
  D1Database,
} from "@cloudflare/workers-types";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

export type AssetFetcher = { fetch(request: Request): Promise<Response> };

export interface WorkersAiBinding {
  run(
    model: string,
    inputs: AiTextGenerationInput,
    options?: object,
  ): Promise<AiTextGenerationOutput>;
}

export interface CloudflareWorkerEnv {
  AI?: WorkersAiBinding;
  AI_GATEWAY_ID?: string;
  BETTER_AUTH_SECRET?: string;
  COFFEE_STAFF_USER_IDS?: string;
  DB: D1Database;
  ASSETS?: AssetFetcher;
}

export interface CloudflareRuntime {
  readonly bindings: {
    readonly ai: Option.Option<WorkersAiBinding>;
    readonly assets: Option.Option<AssetFetcher>;
    readonly db: D1Database;
  };
  readonly config: {
    readonly aiGatewayId: Option.Option<string>;
    readonly betterAuthSecret: Option.Option<Redacted.Redacted<string>>;
    readonly staffUserIds: ReadonlySet<string>;
  };
}

const cloudflareConfig = Config.all({
  aiGatewayId: Config.string("aiGatewayId").pipe(Config.withDefault("")),
  betterAuthSecret: Config.string("betterAuthSecret").pipe(Config.withDefault("")),
  coffeeStaffUserIds: Config.string("coffeeStaffUserIds").pipe(Config.withDefault("")),
});

const decodeTrimmedString = (value: string): string => Schema.decodeUnknownSync(Schema.Trim)(value);

const optionalTrimmedString = (value: string): Option.Option<string> => {
  const trimmed = decodeTrimmedString(value);
  return trimmed === "" ? Option.none() : Option.some(trimmed);
};

const optionalRedactedString = (
  value: string,
  label: string,
): Option.Option<Redacted.Redacted<string>> =>
  Option.map(optionalTrimmedString(value), (secret) => Redacted.make(secret, { label }));

const parseStaffUserIds = (value: string): ReadonlySet<string> =>
  new Set(
    value
      .split(",")
      .map(decodeTrimmedString)
      .filter((entry) => entry !== ""),
  );

export const readCloudflareRuntime = (env: CloudflareWorkerEnv): CloudflareRuntime => {
  const decodedConfig = Effect.runSync(
    cloudflareConfig.parse(ConfigProvider.fromUnknown(env).pipe(ConfigProvider.constantCase)),
  );

  return {
    bindings: {
      ai: Option.fromNullishOr(env.AI),
      assets: Option.fromNullishOr(env.ASSETS),
      db: env.DB,
    },
    config: {
      aiGatewayId: optionalTrimmedString(decodedConfig.aiGatewayId),
      betterAuthSecret: optionalRedactedString(
        decodedConfig.betterAuthSecret,
        "BETTER_AUTH_SECRET",
      ),
      staffUserIds: parseStaffUserIds(decodedConfig.coffeeStaffUserIds),
    },
  };
};

export const revealOptionalSecret = (
  secret: Option.Option<Redacted.Redacted<string>>,
): string | undefined => Option.getOrUndefined(Option.map(secret, Redacted.value));

export const revealSecret = (secret: Redacted.Redacted<string>): string => Redacted.value(secret);

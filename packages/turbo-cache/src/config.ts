import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { ByteLength, Identifier } from "./domain.ts";

export class CacheConfig extends Context.Service<
  CacheConfig,
  {
    readonly team: string;
    readonly writeToken: Redacted.Redacted<string>;
    readonly readToken: Redacted.Redacted<string>;
    readonly maxBytes: number;
  }
>()("TurboCache/Config") {}

const token = (name: string) =>
  Config.redacted(name).pipe(
    Config.mapOrFail((value) =>
      /^[a-zA-Z0-9_-]{32,256}$/.test(Redacted.value(value))
        ? Effect.succeed(value)
        : Effect.fail(
            new Config.ConfigError(
              new ConfigProvider.SourceError({
                message: `${name} must contain 32–256 URL-safe characters`,
              }),
            ),
          ),
    ),
  );

export const cacheConfig = Config.all({
  team: Config.schema(Identifier, "CACHE_TEAM"),
  writeToken: token("CACHE_WRITE_TOKEN"),
  readToken: token("CACHE_READ_TOKEN"),
  maxBytes: Config.schema(ByteLength, "CACHE_MAX_BYTES").pipe(Config.withDefault(64 * 1024 * 1024)),
}).pipe(
  Config.mapOrFail((config) =>
    Redacted.value(config.readToken) === Redacted.value(config.writeToken)
      ? Effect.fail(
          new Config.ConfigError(
            new ConfigProvider.SourceError({ message: "Read and write tokens must differ" }),
          ),
        )
      : Effect.succeed(config),
  ),
);

export const CacheConfigLive = Layer.effect(
  CacheConfig,
  cacheConfig.pipe(Effect.map(CacheConfig.of)),
);

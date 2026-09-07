import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { CacheConfig, cacheConfig } from "@effect-coffee-shop/turbo-cache/config";
import { makeR2Store } from "@effect-coffee-shop/turbo-cache/adapters/r2";
import { handleRequest } from "@effect-coffee-shop/turbo-cache/handler";
import { ArtifactStore } from "@effect-coffee-shop/turbo-cache/store";

export const Artifacts = Cloudflare.R2.Bucket("Artifacts", {
  lifecycleRules: [
    {
      id: "expire-cache",
      enabled: true,
      deleteObjectsTransition: { condition: { type: "Age", maxAge: 14 * 24 * 60 * 60 } },
      abortMultipartUploadsTransition: { condition: { type: "Age", maxAge: 24 * 60 * 60 } },
    },
  ],
});
export default class CacheApi extends Cloudflare.Worker<CacheApi>()(
  "CacheApi",
  Effect.gen(function* () {
    const config = yield* cacheConfig;
    return {
      main: import.meta.filename,
      compatibility: { flags: ["nodejs_compat"] },
      env: {
        CACHE_TEAM: config.team,
        CACHE_WRITE_TOKEN: config.writeToken,
        CACHE_READ_TOKEN: config.readToken,
        CACHE_MAX_BYTES: String(config.maxBytes),
      },
    };
  }),
  Effect.gen(function* () {
    const boundBucket = yield* Cloudflare.R2.ReadWriteBucket(yield* Artifacts);
    return {
      fetch: Effect.gen(function* () {
        const store = yield* makeR2Store(boundBucket);
        const runtimeConfig = yield* cacheConfig.pipe(Effect.orDie);
        const request = yield* HttpServerRequest.HttpServerRequest;
        const web = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
        const response = yield* handleRequest(web).pipe(
          Effect.provideService(ArtifactStore, store),
          Effect.provideService(CacheConfig, runtimeConfig),
        );
        return HttpServerResponse.fromWeb(response).pipe(
          HttpServerResponse.setHeaders(response.headers),
        );
      }),
    };
  }).pipe(Effect.provide(Cloudflare.R2.ReadWriteBucketBinding)),
) {}

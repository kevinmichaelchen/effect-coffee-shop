import * as AWS from "alchemy/AWS";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { CacheConfig, cacheConfig } from "@effect-coffee-shop/turbo-cache/config";
import { makeS3Store } from "@effect-coffee-shop/turbo-cache/adapters/s3";
import { handleRequest } from "@effect-coffee-shop/turbo-cache/handler";
import { ArtifactStore } from "@effect-coffee-shop/turbo-cache/store";

export const Artifacts = AWS.S3.Bucket("Artifacts", {
  encryption: { sseAlgorithm: "AES256" },
  publicAccessBlock: {
    blockPublicAcls: true,
    ignorePublicAcls: true,
    blockPublicPolicy: true,
    restrictPublicBuckets: true,
  },
  lifecycleRules: [
    {
      ID: "expire-cache",
      Status: "Enabled",
      Filter: { Prefix: "" },
      Expiration: { Days: 14 },
      AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
    },
  ],
});
export default class CacheApi extends AWS.ECS.Service<CacheApi>()(
  "CacheApi",
  Effect.gen(function* () {
    const config = yield* cacheConfig;
    const domain = yield* Config.schema(
      Schema.String.check(
        Schema.isPattern(/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/),
      ),
      "CACHE_DOMAIN",
    );
    const writeSecret = yield* AWS.SecretsManager.Secret("WriteToken", {
      secretString: config.writeToken,
    });
    const readSecret = yield* AWS.SecretsManager.Secret("ReadToken", {
      secretString: config.readToken,
    });
    const cluster = yield* AWS.ECS.Cluster("CacheCluster", {});
    return {
      cluster,
      main: import.meta.filename,
      port: 3000,
      cpu: 256,
      memory: 512,
      desiredCount: 1,
      image: "oven/bun:1.4.2",
      loadBalancer: { domain, health: { "3000/http": { path: "/health" } } },
      env: { CACHE_TEAM: config.team, CACHE_MAX_BYTES: String(config.maxBytes) },
      secrets: { CACHE_WRITE_TOKEN: writeSecret.secretArn, CACHE_READ_TOKEN: readSecret.secretArn },
      logging: { retention: "2 weeks" },
    };
  }),
  Effect.gen(function* () {
    const store = yield* makeS3Store(yield* Artifacts);
    return {
      fetch: Effect.gen(function* () {
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
  }).pipe(
    Effect.provide([
      AWS.S3.HeadObjectHttp,
      AWS.S3.GetObjectHttp,
      AWS.S3.CreateMultipartUploadHttp,
      AWS.S3.UploadPartHttp,
      AWS.S3.CompleteMultipartUploadHttp,
      AWS.S3.AbortMultipartUploadHttp,
    ]),
  ),
) {}

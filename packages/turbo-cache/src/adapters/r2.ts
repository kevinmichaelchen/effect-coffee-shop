import type { ReadWriteBucketClient } from "alchemy/Cloudflare/R2";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { ArtifactMetadata, storageFailure } from "../domain.ts";
import { ArtifactStore } from "../store.ts";

// Capture Alchemy's runtime context once; the domain port remains cloud-free.
export const makeR2Store = Effect.fn("TurboCache.makeR2Store")(function* (
  bucket: ReadWriteBucketClient,
) {
  const runtime = yield* Effect.context<import("alchemy/RuntimeContext").RuntimeContext>();
  const metadata = (value: unknown) =>
    Schema.decodeUnknownEffect(ArtifactMetadata)(value).pipe(Effect.mapError(storageFailure));
  return ArtifactStore.of({
    head: Effect.fn("R2.head")(function* (key) {
      const object = yield* bucket
        .head(key)
        .pipe(Effect.provide(runtime), Effect.mapError(storageFailure));
      if (object === null) return Option.none();
      return Option.some({ size: object.size, metadata: yield* metadata(object.customMetadata) });
    }),
    get: Effect.fn("R2.get")(function* (key) {
      const object = yield* bucket
        .get(key)
        .pipe(Effect.provide(runtime), Effect.mapError(storageFailure));
      if (object === null) return Option.none();
      return Option.some({
        size: object.size,
        metadata: yield* metadata(object.customMetadata),
        body: object.body.pipe(Stream.mapError(storageFailure)),
      });
    }),
    begin: Effect.fn("R2.begin")(function* (key, meta) {
      const upload = yield* bucket
        .createMultipartUpload(key, {
          customMetadata: {
            duration: meta.duration,
            tag: meta.tag,
            sha: meta.sha,
            dirtyHash: meta.dirtyHash,
          },
          httpMetadata: { contentType: "application/octet-stream" },
        })
        .pipe(Effect.provide(runtime), Effect.mapError(storageFailure));
      return {
        write: Effect.fn("R2.writePart")((bytes, partNumber) =>
          upload.uploadPart(partNumber, bytes).pipe(Effect.mapError(storageFailure)),
        ),
        complete: Effect.fn("R2.complete")((parts) =>
          upload.complete([...parts]).pipe(Effect.asVoid, Effect.mapError(storageFailure)),
        ),
        abort: Effect.fn("R2.abort")(() => upload.abort().pipe(Effect.mapError(storageFailure))),
      };
    }),
  });
});

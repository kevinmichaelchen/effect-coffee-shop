import * as S3 from "alchemy/AWS/S3";
import type { Bucket } from "alchemy/AWS/S3";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { ArtifactMetadata, storageFailure } from "../domain.ts";
import { ArtifactStore } from "../store.ts";

const StoredMetadata = Schema.Struct({
  duration: ArtifactMetadata.fields.duration,
  tag: ArtifactMetadata.fields.tag,
  sha: ArtifactMetadata.fields.sha,
  dirtyhash: ArtifactMetadata.fields.dirtyHash,
});
const decodeStored = (value: unknown) =>
  Schema.decodeUnknownEffect(StoredMetadata)(value).pipe(
    Effect.map((meta) => ({
      duration: meta.duration,
      tag: meta.tag,
      sha: meta.sha,
      dirtyHash: meta.dirtyhash,
    })),
    Effect.mapError(storageFailure),
  );

export const makeS3Store = Effect.fn("TurboCache.makeS3Store")(function* (bucket: Bucket) {
  const head = yield* S3.HeadObject(bucket);
  const get = yield* S3.GetObject(bucket);
  const create = yield* S3.CreateMultipartUpload(bucket);
  const write = yield* S3.UploadPart(bucket);
  const complete = yield* S3.CompleteMultipartUpload(bucket);
  const abort = yield* S3.AbortMultipartUpload(bucket);
  return s3Store({ head, get, create, write, complete, abort });
});

export interface S3Operations {
  readonly head: Effect.Success<ReturnType<typeof S3.HeadObject>>;
  readonly get: Effect.Success<ReturnType<typeof S3.GetObject>>;
  readonly create: Effect.Success<ReturnType<typeof S3.CreateMultipartUpload>>;
  readonly write: Effect.Success<ReturnType<typeof S3.UploadPart>>;
  readonly complete: Effect.Success<ReturnType<typeof S3.CompleteMultipartUpload>>;
  readonly abort: Effect.Success<ReturnType<typeof S3.AbortMultipartUpload>>;
}

export const s3Store = ({ head, get, create, write, complete, abort }: S3Operations) =>
  ArtifactStore.of({
    head: Effect.fn("S3.head")(function* (key) {
      const object = yield* head({ Key: key }).pipe(
        Effect.map(Option.some),
        Effect.catchTag("NotFound", () => Effect.succeed(Option.none())),
        Effect.mapError(storageFailure),
      );
      if (Option.isNone(object)) return Option.none();
      const size = object.value.ContentLength;
      if (size === undefined) return yield* Effect.fail(storageFailure());
      return Option.some({ size, metadata: yield* decodeStored(object.value.Metadata) });
    }),
    get: Effect.fn("S3.get")(function* (key) {
      const object = yield* get({ Key: key }).pipe(
        Effect.map(Option.some),
        Effect.catchTag("NoSuchKey", () => Effect.succeed(Option.none())),
        Effect.mapError(storageFailure),
      );
      if (Option.isNone(object)) return Option.none();
      const size = object.value.ContentLength;
      const body = object.value.Body;
      if (size === undefined || body === undefined) return yield* Effect.fail(storageFailure());
      return Option.some({
        size,
        metadata: yield* decodeStored(object.value.Metadata),
        body: body.pipe(Stream.mapError(storageFailure)),
      });
    }),
    begin: Effect.fn("S3.begin")(function* (key, meta) {
      // Metadata belongs on CreateMultipartUpload, not individual parts.
      const result = yield* create({
        Key: key,
        ContentType: "application/octet-stream",
        Metadata: {
          duration: meta.duration,
          tag: meta.tag,
          sha: meta.sha,
          dirtyhash: meta.dirtyHash,
        },
      }).pipe(Effect.mapError(storageFailure));
      const UploadId = result.UploadId;
      if (UploadId === undefined) return yield* Effect.fail(storageFailure());
      return {
        write: Effect.fn("S3.writePart")(function* (bytes, partNumber) {
          const part = yield* write({
            Key: key,
            UploadId,
            PartNumber: partNumber,
            Body: bytes,
            ContentLength: bytes.byteLength,
          }).pipe(Effect.mapError(storageFailure));
          if (part.ETag === undefined) return yield* Effect.fail(storageFailure());
          return { partNumber, etag: part.ETag };
        }),
        complete: Effect.fn("S3.complete")((parts) =>
          complete({
            Key: key,
            UploadId,
            MultipartUpload: {
              Parts: parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
            },
          }).pipe(Effect.asVoid, Effect.mapError(storageFailure)),
        ),
        abort: Effect.fn("S3.abort")(() =>
          abort({ Key: key, UploadId }).pipe(Effect.asVoid, Effect.mapError(storageFailure)),
        ),
      };
    }),
  });

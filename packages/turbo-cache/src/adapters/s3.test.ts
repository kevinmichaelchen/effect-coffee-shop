import { it } from "@effect/vitest";
import { expect } from "vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import { s3Store, type S3Operations } from "./s3.ts";

const metadata = { duration: "42", tag: "hmac-signature", sha: "sha", dirtyhash: "dirty" };
const domainMetadata = { duration: "42", tag: "hmac-signature", sha: "sha", dirtyHash: "dirty" };

const operations: S3Operations = {
  head: () => Effect.succeed({ ContentLength: 1, Metadata: metadata }),
  get: () =>
    Effect.succeed({
      ContentLength: 1,
      Metadata: metadata,
      Body: Stream.make(new Uint8Array([9])),
    }),
  create: () => Effect.succeed({ UploadId: "upload-id" }),
  write: () => Effect.succeed({ ETag: "etag" }),
  complete: () => Effect.succeed({}),
  abort: () => Effect.succeed({}),
};

it.effect(
  "attaches signature metadata at multipart creation and completes with ordered ETags",
  () =>
    Effect.gen(function* () {
      const store = s3Store({
        ...operations,
        create: (input) =>
          Effect.sync(() => {
            expect(input).toEqual({
              Key: "team/hash",
              ContentType: "application/octet-stream",
              Metadata: metadata,
            });
            return { UploadId: "upload-id" };
          }),
        write: (input) =>
          Effect.sync(() => {
            expect(input?.UploadId).toBe("upload-id");
            expect(input?.ContentLength).toBe(5 * 1024 * 1024);
            return { ETag: `etag-${input?.PartNumber}` };
          }),
        complete: (input) =>
          Effect.sync(() => {
            expect(input).toEqual({
              Key: "team/hash",
              UploadId: "upload-id",
              MultipartUpload: {
                Parts: [
                  { PartNumber: 1, ETag: "etag-1" },
                  { PartNumber: 2, ETag: "etag-2" },
                ],
              },
            });
            return {};
          }),
      });
      const upload = yield* store.begin("team/hash", domainMetadata);
      const first = yield* upload.write(new Uint8Array(5 * 1024 * 1024), 1);
      const second = yield* upload.write(new Uint8Array(5 * 1024 * 1024), 2);
      yield* upload.complete([first, second]);
    }),
);

it.effect("decodes lowercase S3 metadata and streams the downloaded bytes", () =>
  Effect.gen(function* () {
    const store = s3Store(operations);
    expect(yield* store.head("team/hash")).toEqual(
      Option.some({ size: 1, metadata: domainMetadata }),
    );
    const result = yield* store.get("team/hash");
    if (Option.isNone(result)) return yield* Effect.die("Expected an artifact");
    expect(result.value.metadata).toEqual(domainMetadata);
    expect(yield* Stream.runCollect(result.value.body)).toEqual([new Uint8Array([9])]);
  }),
);

it.effect("fails closed on malformed storage responses", () =>
  Effect.gen(function* () {
    const noId = s3Store({ ...operations, create: () => Effect.succeed({}) });
    const noIdResult = yield* noId.begin("team/hash", domainMetadata).pipe(Effect.flip);
    expect(noIdResult.status).toBe(503);
    const badMetadata = s3Store({
      ...operations,
      head: () => Effect.succeed({ ContentLength: 1, Metadata: {} }),
    });
    expect((yield* badMetadata.head("team/hash").pipe(Effect.flip)).status).toBe(503);
    const noBody = s3Store({
      ...operations,
      get: () => Effect.succeed({ ContentLength: 1, Metadata: metadata }),
    });
    expect((yield* noBody.get("team/hash").pipe(Effect.flip)).status).toBe(503);
    const noEtag = s3Store({ ...operations, write: () => Effect.succeed({}) });
    const upload = yield* noEtag.begin("team/hash", domainMetadata);
    expect((yield* upload.write(new Uint8Array([1]), 1).pipe(Effect.flip)).status).toBe(503);
  }),
);

it.effect("aborts the correct upload", () =>
  Effect.gen(function* () {
    let aborted = false;
    const store = s3Store({
      ...operations,
      abort: (input) =>
        Effect.sync(() => {
          expect(input).toEqual({ Key: "team/hash", UploadId: "upload-id" });
          aborted = true;
          return {};
        }),
    });
    yield* (yield* store.begin("team/hash", domainMetadata)).abort();
    expect(aborted).toBe(true);
  }),
);

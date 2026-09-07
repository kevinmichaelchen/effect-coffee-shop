import { it } from "@effect/vitest";
import { expect } from "vitest";
import * as Effect from "effect/Effect";
import * as Deferred from "effect/Deferred";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import { CacheConfig } from "./config.ts";
import { PART_BYTES, storageFailure } from "./domain.ts";
import { handleRequest } from "./handler.ts";
import { ArtifactStore, type Upload } from "./store.ts";

const config = CacheConfig.of({
  team: "test",
  writeToken: Redacted.make("w".repeat(32)),
  readToken: Redacted.make("r".repeat(32)),
  maxBytes: 64 * 1024 * 1024,
});

const fixture = (failure?: "write" | "complete" | "read") => {
  const writes: number[] = [];
  const state = { begins: 0, completes: 0, aborts: 0 };
  const upload: Upload = {
    write: (bytes, partNumber) =>
      Effect.suspend(() => {
        writes.push(bytes.byteLength);
        return failure === "write"
          ? Effect.fail(storageFailure())
          : Effect.succeed({ partNumber, etag: String(partNumber) });
      }),
    complete: () =>
      Effect.suspend(() => {
        state.completes += 1;
        return failure === "complete" ? Effect.fail(storageFailure()) : Effect.void;
      }),
    abort: () =>
      Effect.sync(() => {
        state.aborts += 1;
      }),
  };
  const store = ArtifactStore.of({
    head: () =>
      failure === "read" ? Effect.fail(storageFailure()) : Effect.succeed(Option.none()),
    get: () => (failure === "read" ? Effect.fail(storageFailure()) : Effect.succeed(Option.none())),
    begin: () =>
      Effect.sync(() => {
        state.begins += 1;
        return upload;
      }),
  });
  const run = (request: Request) =>
    handleRequest(request).pipe(
      Effect.provideService(ArtifactStore, store),
      Effect.provideService(CacheConfig, config),
    );
  return { run, state, writes };
};

const put = (body: Uint8Array, length = String(body.byteLength)) =>
  new Request("http://cache/v8/artifacts/hash?slug=test", {
    method: "PUT",
    body: new Blob([new Uint8Array(body)]),
    headers: {
      authorization: `Bearer ${Redacted.value(config.writeToken)}`,
      "content-length": length,
    },
  });

it.effect("packs multipart uploads and completes only after the final byte", () =>
  Effect.gen(function* () {
    const test = fixture();
    const response = yield* test.run(put(new Uint8Array(PART_BYTES * 2 + 13)));
    expect(response.status).toBe(200);
    expect(test.writes).toEqual([PART_BYTES, PART_BYTES, 13]);
    expect(test.state).toEqual({ begins: 1, completes: 1, aborts: 0 });
  }),
);

it.effect("aborts uploads for truncated and oversized bodies", () =>
  Effect.gen(function* () {
    yield* Effect.forEach(
      ["1", "100"],
      Effect.fnUntraced(function* (declared) {
        const test = fixture();
        expect((yield* test.run(put(new Uint8Array(10), declared))).status).toBe(400);
        expect(test.state).toEqual({ begins: 1, completes: 0, aborts: 1 });
      }),
      { concurrency: 1, discard: true },
    );
  }),
);

it.effect("aborts failed writes and failed completion without returning success", () =>
  Effect.gen(function* () {
    const failedWrite = fixture("write");
    expect((yield* failedWrite.run(put(new Uint8Array(10)))).status).toBe(503);
    expect(failedWrite.state).toEqual({ begins: 1, completes: 0, aborts: 1 });
    const failedComplete = fixture("complete");
    expect((yield* failedComplete.run(put(new Uint8Array(10)))).status).toBe(503);
    expect(failedComplete.state).toEqual({ begins: 1, completes: 1, aborts: 1 });
  }),
);

it.effect("aborts multipart state when the request fiber is interrupted", () =>
  Effect.gen(function* () {
    const started = yield* Deferred.make<void>();
    let aborted = false;
    const store = ArtifactStore.of({
      head: () => Effect.succeedNone,
      get: () => Effect.succeedNone,
      begin: () =>
        Effect.succeed({
          write: () => Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)),
          complete: () => Effect.die("Interrupted upload must never complete"),
          abort: () =>
            Effect.sync(() => {
              aborted = true;
            }),
        }),
    });
    const fiber = yield* handleRequest(put(new Uint8Array(PART_BYTES))).pipe(
      Effect.provideService(ArtifactStore, store),
      Effect.provideService(CacheConfig, config),
      Effect.forkChild,
    );
    yield* Deferred.await(started);
    yield* Fiber.interrupt(fiber);
    expect(aborted).toBe(true);
  }),
);

it.effect("rejects invalid lengths and metadata before creating an upload", () =>
  Effect.gen(function* () {
    const test = fixture();
    yield* Effect.forEach(
      [
        ["0", 413],
        ["67108865", 413],
        ["abc", 400],
      ],
      Effect.fnUntraced(function* ([length, expected]) {
        const request = put(new Uint8Array(1), String(length));
        expect((yield* test.run(request)).status).toBe(expected);
      }),
      { concurrency: 1, discard: true },
    );
    const missing = put(new Uint8Array(1));
    missing.headers.delete("content-length");
    expect((yield* test.run(missing)).status).toBe(411);
    const badMetadata = put(new Uint8Array(1));
    badMetadata.headers.set("x-artifact-duration", "NaN");
    expect((yield* test.run(badMetadata)).status).toBe(400);
    expect(test.state.begins).toBe(0);
  }),
);

it.effect("distinguishes storage outages from cache misses, including HEAD", () =>
  Effect.gen(function* () {
    yield* Effect.forEach(
      ["GET", "HEAD"],
      Effect.fnUntraced(function* (method) {
        const request = () =>
          new Request("http://cache/v8/artifacts/hash?teamId=test", {
            method,
            headers: { authorization: `Bearer ${Redacted.value(config.readToken)}` },
          });
        expect((yield* fixture("read").run(request())).status).toBe(503);
        const miss = yield* fixture().run(request());
        expect(miss.status).toBe(404);
        expect(miss.body).toBeNull();
      }),
      { concurrency: 1, discard: true },
    );
  }),
);

it.effect("rejects unauthenticated writes, read-only writes, and conflicting tenants", () =>
  Effect.gen(function* () {
    const test = fixture();
    yield* Effect.forEach(
      [
        ["", "slug=test", 401],
        [`Bearer ${Redacted.value(config.readToken)}`, "slug=test", 403],
        [`Bearer ${Redacted.value(config.writeToken)}`, "slug=test&teamId=other", 403],
        [`Bearer ${Redacted.value(config.writeToken)}`, "", 403],
      ],
      Effect.fnUntraced(function* ([authorization, query, status]) {
        const response = yield* test.run(
          new Request(`http://cache/v8/artifacts/hash?${query}`, {
            method: "PUT",
            headers: { authorization: String(authorization) },
          }),
        );
        expect(response.status).toBe(status);
      }),
      { concurrency: 1, discard: true },
    );
    expect(test.state.begins).toBe(0);
  }),
);

it.effect("preserves download metadata and stream bytes", () =>
  Effect.gen(function* () {
    const metadata = { duration: "12", tag: "signed", sha: "sha", dirtyHash: "dirty" };
    const object = { size: 3, metadata, body: Stream.make(new Uint8Array([1, 2, 3])) };
    const store = ArtifactStore.of({
      head: () => Effect.succeed(Option.some(object)),
      get: () => Effect.succeed(Option.some(object)),
      begin: () => Effect.fail(storageFailure()),
    });
    const response = yield* handleRequest(
      new Request("http://cache/artifacts/hash?slug=test", {
        headers: { authorization: `Bearer ${Redacted.value(config.readToken)}` },
      }),
    ).pipe(Effect.provideService(ArtifactStore, store), Effect.provideService(CacheConfig, config));
    expect(response.headers.get("x-artifact-tag")).toBe("signed");
    expect(response.headers.get("content-length")).toBe("3");
    expect(new Uint8Array(yield* Effect.promise(() => response.arrayBuffer()))).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  }),
);

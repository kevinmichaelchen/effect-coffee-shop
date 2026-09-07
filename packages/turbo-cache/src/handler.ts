import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { authorize } from "./auth.ts";
import { artifactParts, discardRejectedBody } from "./body.ts";
import { ArtifactMetadata, ByteLength, CacheError, Identifier, invalidRequest } from "./domain.ts";
import { ArtifactStore, type StoredArtifact, type UploadedPart } from "./store.ts";

const responseHeaders = (artifact: StoredArtifact) => ({
  "content-type": "application/octet-stream",
  "content-length": String(artifact.size),
  "cache-control": "private, no-store",
  "x-artifact-duration": artifact.metadata.duration,
  "x-artifact-tag": artifact.metadata.tag,
  "x-artifact-sha": artifact.metadata.sha,
  "x-artifact-dirty-hash": artifact.metadata.dirtyHash,
});

const uploadArtifact = Effect.fn("TurboCache.upload")(function* (
  request: Request,
  key: string,
  maxBytes: number,
) {
  const length = request.headers.get("content-length");
  if (length === null)
    return yield* Effect.fail(new CacheError({ status: 411, message: "Content-Length required" }));
  if (!/^\d+$/.test(length)) return yield* Effect.fail(invalidRequest());
  const size = yield* Schema.decodeUnknownEffect(ByteLength)(Number(length)).pipe(
    Effect.mapError(() => new CacheError({ status: 413, message: "Artifact too large or empty" })),
  );
  if (size > maxBytes)
    return yield* Effect.fail(new CacheError({ status: 413, message: "Artifact too large" }));
  const body = request.body;
  if (body === null) return yield* Effect.fail(invalidRequest());
  const metadata = yield* Schema.decodeUnknownEffect(ArtifactMetadata)({
    duration: request.headers.get("x-artifact-duration") ?? "0",
    tag: request.headers.get("x-artifact-tag") ?? "",
    sha: request.headers.get("x-artifact-sha") ?? "",
    dirtyHash: request.headers.get("x-artifact-dirty-hash") ?? "",
  }).pipe(Effect.mapError(invalidRequest));
  const store = yield* ArtifactStore;
  yield* Effect.acquireUseRelease(
    store.begin(key, metadata),
    (upload) =>
      Effect.gen(function* () {
        const parts = yield* Ref.make<ReadonlyArray<UploadedPart>>([]);
        yield* artifactParts(body, size).pipe(
          Stream.runForEach((bytes) =>
            Effect.gen(function* () {
              const completed = yield* Ref.get(parts);
              const part = yield* upload.write(bytes, completed.length + 1);
              yield* Ref.update(parts, (previous) => [...previous, part]);
            }),
          ),
        );
        yield* upload.complete(yield* Ref.get(parts));
      }),
    (upload, exit) =>
      Exit.isFailure(exit)
        ? upload
            .abort()
            .pipe(Effect.catch(() => Effect.logWarning("Turbo cache multipart cleanup failed")))
        : Effect.void,
  );
  return new Response(null, { status: 200 });
});

const route = Effect.fn("TurboCache.route")(function* (request: Request) {
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") return new Response("ok");
  const config = yield* authorize(request, url);
  const path = url.pathname.replace(/^\/v8\//, "/");
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-methods": "GET, HEAD, PUT, POST, OPTIONS",
        "access-control-allow-headers":
          "Authorization, Content-Type, User-Agent, x-artifact-duration, x-artifact-tag, x-artifact-sha, x-artifact-dirty-hash",
      },
    });
  }
  if (path === "/artifacts/status" && request.method === "GET")
    return Response.json({ status: "enabled" });
  if (path === "/artifacts/events" && request.method === "POST")
    return new Response(null, { status: 204 });
  const match = /^\/artifacts\/([^/]+)$/.exec(path);
  if (match?.[1] === undefined) return new Response(null, { status: 404 });
  const hash = yield* Schema.decodeUnknownEffect(Identifier)(match[1]).pipe(
    Effect.mapError(invalidRequest),
  );
  const key = `${config.team}/${hash}`;
  if (request.method === "PUT") return yield* uploadArtifact(request, key, config.maxBytes);
  const store = yield* ArtifactStore;
  if (request.method === "HEAD") {
    const artifact = yield* store.head(key);
    return Option.isNone(artifact)
      ? new Response(null, { status: 404 })
      : new Response(null, { headers: responseHeaders(artifact.value) });
  }
  if (request.method === "GET") {
    const artifact = yield* store.get(key);
    if (Option.isNone(artifact)) return new Response(null, { status: 404 });
    const body = yield* Stream.toReadableStreamEffect(artifact.value.body);
    return new Response(body, { headers: responseHeaders(artifact.value) });
  }
  return new Response(null, { status: 405, headers: { allow: "GET, HEAD, PUT, OPTIONS" } });
});

export const handleRequest = Effect.fn("TurboCache.handleRequest")((request: Request) =>
  route(request).pipe(
    Effect.catchTag("CacheError", (error) =>
      Effect.gen(function* () {
        if (request.body !== null && !request.body.locked) {
          yield* discardRejectedBody(request.body);
        }
        return new Response(request.method === "HEAD" ? null : error.message, {
          status: error.status,
          headers: {
            "cache-control": "no-store",
            // Rejected uploads may leave request bytes unread. Tell HTTP/1
            // peers to close that connection instead of pooling it.
            ...(request.body !== null ? { connection: "close" } : {}),
          },
        });
      }),
    ),
  ),
);

import * as Alchemy from "alchemy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Test from "alchemy/Test/Vitest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpBody from "effect/http/HttpBody";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import type { HttpMethod } from "effect/http/HttpMethod";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { expect } from "vitest";
import Stack from "./cloudflare.ts";

const { afterAll, beforeAll, deploy, destroy, test } = Test.make({
  dev: true,
  providers: Cloudflare.providers(),
  sidecar: false,
  state: Alchemy.localState(),
});
const deployed = beforeAll(deploy(Stack), { timeout: 120_000 });
afterAll(destroy(Stack), { timeout: 120_000 });

const writeToken = "test-write-token-not-a-real-secret-0001";
const readToken = "test-read-token-not-a-real-secret-00002";
const request = Effect.fn(function* (
  url: string,
  path: string,
  init: {
    readonly method?: HttpMethod;
    readonly body?: HttpBody.HttpBody;
    readonly headers?: Record<string, string>;
  } = {},
) {
  const client = yield* HttpClient.HttpClient;
  return yield* client
    .execute(
      HttpClientRequest.make(init.method ?? "GET")(new URL(path, url), {
        headers: init.headers ?? {},
        body: init.body ?? HttpBody.empty,
      }),
    )
    .pipe(Effect.orDie);
});

const readMethods: ReadonlyArray<HttpMethod> = ["GET", "HEAD"];
const sameBytes = (left: Uint8Array, right: Uint8Array) =>
  left.length === right.length && left.every((byte, index) => byte === right[index]);

const encodeJsonString = Schema.encodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

// Runs the real Turbo CLI and fails, like execFile, when it exits non-zero.
const runTurbo = Effect.fn(
  function* (input: { readonly cwd: string; readonly turbo: string; readonly url: string }) {
    const handle = yield* ChildProcess.make(
      input.turbo,
      ["run", "build", "--cache=remote:rw", "--preflight"],
      {
        cwd: input.cwd,
        extendEnv: true,
        env: {
          TURBO_API: input.url,
          TURBO_TEAM: "cache-test",
          TURBO_TOKEN: writeToken,
          TURBO_REMOTE_CACHE_SIGNATURE_KEY: "test-signing-key-never-use-in-production",
          TURBO_TELEMETRY_DISABLED: "1",
        },
      },
    );
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        Stream.mkString(Stream.decodeText(handle.stdout)),
        Stream.mkString(Stream.decodeText(handle.stderr)),
        handle.exitCode,
      ],
      { concurrency: "unbounded" },
    );
    if (exitCode !== 0) return yield* Effect.die(`turbo exited with ${exitCode}: ${stderr}`);
    return { stdout };
  },
  Effect.scoped,
  Effect.timeout("30 seconds"),
  Effect.orDie,
);

test(
  "the real Turbo CLI restores a signed multipart artifact from an empty local cache",
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const url = yield* Schema.decodeUnknownEffect(Schema.String)((yield* deployed).url);
    const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "effect-turbo-cache-" });
    const bytes = SecureRandom.randomBytesUnsafe(9 * 1024 * 1024 + 7);
    yield* fs.writeFile(path.join(cwd, "input.bin"), bytes);
    yield* fs.writeFileString(
      path.join(cwd, "package.json"),
      encodeJsonString({
        name: "signed-cache-fixture",
        private: true,
        packageManager: "bun@1.4.4",
        scripts: { build: "node build.mjs" },
      }),
    );
    yield* fs.writeFileString(
      path.join(cwd, "turbo.json"),
      encodeJsonString({
        remoteCache: { signature: true },
        tasks: { build: { outputs: ["dist/**"], inputs: ["input.bin", "build.mjs"] } },
      }),
    );
    yield* fs.writeFileString(
      path.join(cwd, "build.mjs"),
      'import { mkdirSync, copyFileSync, appendFileSync } from "node:fs"; mkdirSync("dist", {recursive:true}); copyFileSync("input.bin", "dist/output.bin"); appendFileSync("executions", "built\\n");',
    );
    const turbo = path.resolve(import.meta.dirname, "../../node_modules/.bin/turbo");
    yield* runTurbo({ cwd, turbo, url });
    yield* fs.remove(path.join(cwd, "dist"), { recursive: true });
    yield* fs.remove(path.join(cwd, ".turbo"), { recursive: true, force: true });
    const restored = yield* runTurbo({ cwd, turbo, url });
    expect(restored.stdout).toContain("1 cached");
    expect(sameBytes(yield* fs.readFile(path.join(cwd, "dist/output.bin")), bytes)).toBe(true);
    expect(yield* fs.readFileString(path.join(cwd, "executions"))).toBe("built\n");
  }),
);

test(
  "round-trips metadata and bytes above the multipart/signature boundary",
  Effect.gen(function* () {
    const url = yield* Schema.decodeUnknownEffect(Schema.String)((yield* deployed).url);
    const bytes = new Uint8Array(9 * 1024 * 1024 + 7).fill(137);
    const path = "/v8/artifacts/large-artifact?slug=cache-test";
    const put = yield* request(url, path, {
      method: "PUT",
      body: HttpBody.uint8Array(bytes),
      headers: {
        authorization: `Bearer ${writeToken}`,
        "content-length": String(bytes.byteLength),
        "x-artifact-tag": "signature-preserved-at-9-MiB",
        "x-artifact-duration": "1234",
        "x-artifact-sha": "abcdef",
        "x-artifact-dirty-hash": "dirty123",
      },
    });
    expect(put.status).toBe(200);
    const head = yield* request(url, path, {
      method: "HEAD",
      headers: { authorization: `Bearer ${readToken}` },
    });
    expect(head.headers["content-length"]).toBe(String(bytes.byteLength));
    yield* Effect.forEach(
      readMethods,
      Effect.fnUntraced(function* (method) {
        const result = yield* request(url, path, {
          method,
          headers: { authorization: `Bearer ${readToken}` },
        });
        expect(result.status).toBe(200);
        expect(result.headers["x-artifact-tag"]).toBe("signature-preserved-at-9-MiB");
        expect(result.headers["x-artifact-duration"]).toBe("1234");
        expect(result.headers["x-artifact-sha"]).toBe("abcdef");
        expect(result.headers["x-artifact-dirty-hash"]).toBe("dirty123");
        const body = yield* result.arrayBuffer.pipe(Effect.orDie);
        expect(sameBytes(new Uint8Array(body), method === "GET" ? bytes : new Uint8Array())).toBe(
          true,
        );
      }),
      { concurrency: 1, discard: true },
    );
  }),
);

test(
  "enforces authentication, tenant boundaries, write permissions and preflight",
  Effect.gen(function* () {
    const url = yield* Schema.decodeUnknownEffect(Schema.String)((yield* deployed).url);
    const status = Effect.fn(function* (path: string, init: Parameters<typeof request>[2] = {}) {
      const response = yield* request(url, path, init);
      // Consume error responses so the test itself does not hold open connections.
      yield* response.text.pipe(Effect.orDie);
      return response.status;
    });
    expect(yield* status("/v8/artifacts/status?slug=cache-test")).toBe(401);
    expect(
      yield* status("/v8/artifacts/status?slug=other", {
        headers: { authorization: `Bearer ${readToken}` },
      }),
    ).toBe(403);
    yield* Effect.forEach(
      Array.from({ length: 20 }, (_, index) => index),
      Effect.fnUntraced(function* (attempt) {
        expect(
          yield* status(`/v8/artifacts/forbidden-${attempt}?slug=cache-test`, {
            method: "PUT",
            body: HttpBody.text("bad"),
            headers: { authorization: `Bearer ${readToken}` },
          }),
        ).toBe(403);
        const preflight = yield* request(url, "/v8/artifacts/test", {
          method: "OPTIONS",
          headers: { authorization: `Bearer ${writeToken}` },
        });
        expect({
          status: preflight.status,
          body: yield* preflight.text.pipe(Effect.orDie),
        }).toEqual({ status: 204, body: "" });
        expect(preflight.headers["access-control-allow-headers"]).toContain("Authorization");
      }),
      { concurrency: 1, discard: true },
    );
    expect(
      yield* status("/v8/artifacts/missing?slug=cache-test", {
        headers: { authorization: `Bearer ${readToken}` },
      }),
    ).toBe(404);
  }),
);

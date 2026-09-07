import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Test from "alchemy/Test/Vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { expect } from "vitest";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
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
const request = (url: string, path: string, init: RequestInit = {}) =>
  Effect.promise((signal) => fetch(new URL(path, url), { ...init, signal }));

const execute = promisify(execFile);

test(
  "the real Turbo CLI restores a signed multipart artifact from an empty local cache",
  Effect.gen(function* () {
    const url = yield* Schema.decodeUnknownEffect(Schema.String)((yield* deployed).url);
    const cwd = yield* Effect.acquireRelease(
      Effect.promise(() => mkdtemp(join(tmpdir(), "effect-turbo-cache-"))),
      (directory) => Effect.promise(() => rm(directory, { recursive: true, force: true })),
    );
    const bytes = randomBytes(9 * 1024 * 1024 + 7);
    yield* Effect.promise(() => writeFile(join(cwd, "input.bin"), bytes));
    yield* Effect.promise(() =>
      writeFile(
        join(cwd, "package.json"),
        JSON.stringify({
          name: "signed-cache-fixture",
          private: true,
          packageManager: "bun@1.4.2",
          scripts: { build: "node build.mjs" },
        }),
      ),
    );
    yield* Effect.promise(() =>
      writeFile(
        join(cwd, "turbo.json"),
        JSON.stringify({
          remoteCache: { signature: true },
          tasks: { build: { outputs: ["dist/**"], inputs: ["input.bin", "build.mjs"] } },
        }),
      ),
    );
    yield* Effect.promise(() =>
      writeFile(
        join(cwd, "build.mjs"),
        'import { mkdirSync, copyFileSync, appendFileSync } from "node:fs"; mkdirSync("dist", {recursive:true}); copyFileSync("input.bin", "dist/output.bin"); appendFileSync("executions", "built\\n");',
      ),
    );
    const turbo = resolve("node_modules/.bin/turbo");
    const run = () =>
      Effect.promise((signal) =>
        execute(turbo, ["run", "build", "--cache=remote:rw", "--preflight"], {
          cwd,
          signal,
          timeout: 30_000,
          env: {
            ...process.env,
            TURBO_API: url,
            TURBO_TEAM: "cache-test",
            TURBO_TOKEN: writeToken,
            TURBO_REMOTE_CACHE_SIGNATURE_KEY: "test-signing-key-never-use-in-production",
            TURBO_TELEMETRY_DISABLED: "1",
          },
        }),
      );
    yield* run();
    yield* Effect.promise(() => rm(join(cwd, "dist"), { recursive: true }));
    yield* Effect.promise(() => rm(join(cwd, ".turbo"), { recursive: true, force: true }));
    const restored = yield* run();
    expect(restored.stdout).toContain("1 cached");
    expect(
      (yield* Effect.promise(() => readFile(join(cwd, "dist/output.bin")))).equals(bytes),
    ).toBe(true);
    expect(yield* Effect.promise(() => readFile(join(cwd, "executions"), "utf8"))).toBe("built\n");
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
      body: bytes,
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
    for (const method of ["GET", "HEAD"]) {
      const result = yield* request(url, path, {
        method,
        headers: { authorization: `Bearer ${readToken}` },
      });
      expect(result.status).toBe(200);
      if (method === "HEAD")
        expect(result.headers.get("content-length")).toBe(String(bytes.byteLength));
      expect(result.headers.get("x-artifact-tag")).toBe("signature-preserved-at-9-MiB");
      expect(result.headers.get("x-artifact-duration")).toBe("1234");
      expect(result.headers.get("x-artifact-sha")).toBe("abcdef");
      expect(result.headers.get("x-artifact-dirty-hash")).toBe("dirty123");
      const body = yield* Effect.promise(() => result.arrayBuffer());
      expect(
        Buffer.from(body).equals(Buffer.from(method === "GET" ? bytes : new Uint8Array())),
      ).toBe(true);
    }
  }),
);

test(
  "enforces authentication, tenant boundaries, write permissions and preflight",
  Effect.gen(function* () {
    const url = yield* Schema.decodeUnknownEffect(Schema.String)((yield* deployed).url);
    const status = Effect.fn(function* (path: string, init: RequestInit = {}) {
      const response = yield* request(url, path, init);
      // Consume error responses so the test itself does not hold open connections.
      yield* Effect.promise(() => response.text());
      return response.status;
    });
    expect(yield* status("/v8/artifacts/status?slug=cache-test")).toBe(401);
    expect(
      yield* status("/v8/artifacts/status?slug=other", {
        headers: { authorization: `Bearer ${readToken}` },
      }),
    ).toBe(403);
    for (const attempt of Array.from({ length: 20 }, (_, index) => index)) {
      expect(
        yield* status(`/v8/artifacts/forbidden-${attempt}?slug=cache-test`, {
          method: "PUT",
          body: "bad",
          headers: { authorization: `Bearer ${readToken}` },
        }),
      ).toBe(403);
      const preflight = yield* request(url, "/v8/artifacts/test", {
        method: "OPTIONS",
        headers: { authorization: `Bearer ${writeToken}` },
      });
      expect({
        status: preflight.status,
        body: yield* Effect.promise(() => preflight.text()),
      }).toEqual({ status: 204, body: "" });
      expect(preflight.headers.get("access-control-allow-headers")).toContain("Authorization");
    }
    expect(
      yield* status("/v8/artifacts/missing?slug=cache-test", {
        headers: { authorization: `Bearer ${readToken}` },
      }),
    ).toBe(404);
  }),
);

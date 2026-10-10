import { assert, it } from "@effect/vitest";
import type { D1Database, ExecutionContext } from "@cloudflare/workers-types";
import { D1 } from "@alchemy.run/cloudflare-runtime/core/bindings";
import { getPlatformProxy } from "@alchemy.run/cloudflare-runtime/core/platform-proxy";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { vi } from "vitest";
import worker from "./worker.ts";

const ConsoleEvent = Schema.fromJsonString(
  Schema.Struct({
    event: Schema.Literal("http_routing.request"),
    status: Schema.Literals(["ok", "error"]),
    requestId: Schema.String,
    errorType: Schema.optional(Schema.String),
    route_kind: Schema.String,
  }),
);

const executionContext: Pick<ExecutionContext, "waitUntil"> = {
  waitUntil: () => {},
};

it.live(
  "the Worker resolves secret and asset failures with one safe event and a correlated response",
  () =>
    Effect.acquireUseRelease(
      Effect.promise(() =>
        getPlatformProxy<{ readonly DB: D1Database }>({
          bindings: [D1.local({ binding: "DB" })],
          name: "coffee-cloudflare-worker-event-test",
        }),
      ),
      (proxy) =>
        Effect.acquireUseRelease(
          Effect.sync(() => vi.spyOn(console, "log").mockImplementation(() => {})),
          (consoleLog) =>
            Effect.forEach(
              [
                {
                  path: "/api/auth/get-session",
                  routeKind: "auth",
                  errorType: "Failure",
                  status: 500,
                },
                {
                  path: "/assets/private-password",
                  routeKind: "assets",
                  errorType: "Defect",
                  status: 500,
                },
                { path: "/coffee", routeKind: "assets", errorType: undefined, status: 202 },
              ],
              (example) =>
                Effect.gen(function* () {
                  consoleLog.mockClear();
                  const response = yield* Effect.promise(() =>
                    worker.fetch(
                      new Request(`https://coffee.example${example.path}`),
                      {
                        DB: proxy.env.DB,
                        AUTH_SECRET: {
                          get: () => Promise.reject({ message: "private-password" }),
                        },
                        ASSETS: {
                          fetch: (request) =>
                            request.url.endsWith("/coffee")
                              ? Promise.resolve(new Response("coffee", { status: 202 }))
                              : Promise.reject({ message: "private-password" }),
                        },
                      },
                      executionContext,
                    ),
                  );
                  assert.strictEqual(response.status, example.status);
                  const calls = yield* Schema.decodeUnknownEffect(
                    Schema.Tuple([Schema.Tuple([Schema.String])]),
                  )(consoleLog.mock.calls);
                  const event = yield* Schema.decodeEffect(ConsoleEvent)(calls[0][0]);
                  assert.strictEqual(event.status, example.errorType ? "error" : "ok");
                  assert.strictEqual(event.errorType, example.errorType);
                  assert.strictEqual(event.route_kind, example.routeKind);
                  assert.strictEqual(response.headers.get("x-request-id"), event.requestId);
                  assert.strictEqual(calls[0][0].includes("private-password"), false);
                  assert.strictEqual(
                    yield* Effect.promise(() => response.text()),
                    example.errorType ? "" : "coffee",
                  );
                }),
              { concurrency: 1 },
            ),
          (consoleLog) => Effect.sync(() => consoleLog.mockRestore()),
        ),
      (proxy) => Effect.promise(() => proxy.dispose()),
    ),
);

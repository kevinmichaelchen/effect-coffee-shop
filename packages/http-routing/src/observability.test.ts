import { assert, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { FetchHttpClient } from "effect/http";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { vi } from "vitest";
import { HttpObservabilityLive } from "./observability.ts";
import { createHttpRouter } from "./router.ts";

const ConsoleEvent = Schema.fromJsonString(
  Schema.Struct({
    event: Schema.Literal("http_routing.request"),
    status: Schema.Literal("ok"),
    requestId: Schema.String,
  }),
);
const OtlpLogs = Schema.fromJsonString(
  Schema.Struct({
    resourceLogs: Schema.Array(
      Schema.Struct({
        scopeLogs: Schema.Array(
          Schema.Struct({
            logRecords: Schema.Array(
              Schema.Struct({
                attributes: Schema.Array(
                  Schema.Struct({ key: Schema.String, value: Schema.Unknown }),
                ),
              }),
            ),
          }),
        ),
      }),
    ),
  }),
);

// Records OTLP exports in memory: the exporter's HttpClient reads this Fetch reference.
const recordingFetch = (requests: Array<{ readonly path: string; readonly body: string }>) =>
  Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push({ path: new URL(request.url).pathname, body: await request.text() });
      return new Response("{}");
    },
    { preconnect: globalThis.fetch.preconnect },
  );

it.live(
  "keeps one flat JSON console event and exports one OTLP log when an endpoint is configured",
  () =>
    Effect.acquireUseRelease(
      Effect.sync(() => vi.spyOn(console, "log").mockImplementation(() => {})),
      (consoleLog) =>
        Effect.gen(function* () {
          const requests: Array<{ readonly path: string; readonly body: string }> = [];
          const response = yield* createHttpRouter([])(
            new Request("https://coffee.example/missing"),
            undefined,
          ).pipe(
            Effect.provide(
              HttpObservabilityLive.pipe(
                Layer.provide(
                  Layer.mergeAll(
                    Layer.succeed(FetchHttpClient.Fetch, recordingFetch(requests)),
                    ConfigProvider.layer(
                      ConfigProvider.fromUnknown({
                        OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector.test",
                      }),
                    ),
                  ),
                ),
              ),
            ),
          );
          const calls = yield* Schema.decodeUnknownEffect(
            Schema.Tuple([Schema.Tuple([ConsoleEvent])]),
          )(consoleLog.mock.calls);
          assert.strictEqual(response.headers.get("x-request-id"), calls[0][0].requestId);
          const logRequests = requests.filter((request) => request.path === "/v1/logs");
          assert.strictEqual(logRequests.length, 1);
          const logRequest = yield* Schema.decodeUnknownEffect(
            Schema.Tuple([Schema.Struct({ body: OtlpLogs })]),
          )(logRequests);
          const logs = logRequest[0].body.resourceLogs.flatMap((resource) =>
            resource.scopeLogs.flatMap((scope) => scope.logRecords),
          );
          assert.strictEqual(logs.length, 1);
          assert.strictEqual(
            logs[0]?.attributes.some((attribute) => attribute.key === "requestId"),
            true,
          );
        }),
      (consoleLog) => Effect.sync(() => consoleLog.mockRestore()),
    ),
);

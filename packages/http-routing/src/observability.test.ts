import { assert, it } from "@effect/vitest";
// oxlint-disable-next-line effect/use-http-client-service -- Native loopback HTTP server receives OTLP exports; this is a collector adapter, not an outgoing client.
import { createServer } from "node:http";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
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

it.live(
  "keeps one flat JSON console event and exports one OTLP log when an endpoint is configured",
  () =>
    Effect.acquireUseRelease(
      Effect.promise(() => {
        const requests: Array<{ readonly path: string; readonly body: string }> = [];
        const server = createServer((request, response) => {
          request.setEncoding("utf8");
          let body = "";
          request.on("data", (chunk: string) => {
            body += chunk;
          });
          request.on("end", () => {
            requests.push({ path: request.url ?? "", body });
            response.end("{}");
          });
        });
        return new Promise<{
          readonly requests: typeof requests;
          readonly server: typeof server;
          readonly endpoint: string;
        }>((resolve) => {
          server.listen(0, "127.0.0.1", () => {
            const address = Schema.decodeUnknownSync(Schema.Struct({ port: Schema.Int }))(
              server.address(),
            );
            resolve({ requests, server, endpoint: `http://127.0.0.1:${address.port}` });
          });
        });
      }),
      (collector) =>
        Effect.acquireUseRelease(
          Effect.sync(() => vi.spyOn(console, "log").mockImplementation(() => {})),
          (consoleLog) =>
            Effect.gen(function* () {
              const response = yield* createHttpRouter([])(
                new Request("https://coffee.example/missing"),
                undefined,
              ).pipe(
                Effect.provide(
                  HttpObservabilityLive.pipe(
                    Layer.provide(
                      ConfigProvider.layer(
                        ConfigProvider.fromUnknown({
                          OTEL_EXPORTER_OTLP_ENDPOINT: collector.endpoint,
                        }),
                      ),
                    ),
                  ),
                ),
              );
              const calls = yield* Schema.decodeUnknownEffect(
                Schema.Tuple([Schema.Tuple([ConsoleEvent])]),
              )(consoleLog.mock.calls);
              assert.strictEqual(response.headers.get("x-request-id"), calls[0][0].requestId);
              const logRequests = collector.requests.filter(
                (request) => request.path === "/v1/logs",
              );
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
      (collector) =>
        Effect.promise(
          () =>
            new Promise<void>((resolve, reject) =>
              collector.server.close((error) => (error ? reject(error) : resolve())),
            ),
        ),
    ),
);

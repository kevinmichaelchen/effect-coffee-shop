import { assert, describe, it } from "@effect/vitest";
import { safeHttpEffect } from "alchemy/Http";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { vi } from "vitest";
import { lambdaFetch } from "./lambda.ts";
import * as AwsEnvironment from "./env.ts";
import * as AwsRouting from "./router.ts";

const Event = Schema.fromJsonString(
  Schema.Struct({
    event: Schema.Literal("http_routing.request"),
    status: Schema.Literals(["ok", "error"]),
    requestId: Schema.String,
    route_kind: Schema.String,
    errorType: Schema.optional(Schema.String),
    errorMessage: Schema.optional(Schema.String),
    http_status: Schema.optional(Schema.Finite),
  }),
);

const invokeRequest = (
  request: HttpServerRequest.HttpServerRequest,
  config: Readonly<Record<string, string>>,
) =>
  safeHttpEffect(lambdaFetch()).pipe(
    Effect.provideService(HttpServerRequest.HttpServerRequest, request),
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(config))),
    Effect.scoped,
  );

const invoke = (path: string, config: Readonly<Record<string, string>>) =>
  invokeRequest(HttpServerRequest.fromWeb(new Request(`https://coffee.example${path}`)), config);

const captureInvocation = (effect: Effect.Effect<HttpServerResponse.HttpServerResponse, never>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => vi.spyOn(console, "log").mockImplementation(() => {})),
    (consoleLog) =>
      Effect.gen(function* () {
        const response = yield* effect;
        const calls = yield* Schema.decodeUnknownEffect(
          Schema.Tuple([Schema.Tuple([Schema.String])]),
        )(consoleLog.mock.calls);
        const event = yield* Schema.decodeEffect(Event)(calls[0][0]);
        assert.strictEqual(response.headers["x-request-id"], event.requestId);
        assert.strictEqual(calls[0][0].includes("private-password"), false);
        return { event, response };
      }),
    (consoleLog) => Effect.sync(() => consoleLog.mockRestore()),
  );

const config = { COFFEE_POSTGRES_URL: "postgres://user:private-password@localhost/coffee" };
const throwDecoderDefect = (): never => {
  throw { message: "private-password" };
};

describe("registered Lambda fetch effect", () => {
  it.live("logs missing runtime configuration before routing once and returns 500", () =>
    Effect.gen(function* () {
      const { event, response } = yield* captureInvocation(invoke("/missing", {}));
      assert.strictEqual(response.status, 500);
      assert.strictEqual(event.status, "error");
      assert.strictEqual(event.errorType, "Defect");
      assert.strictEqual(event.route_kind, "unmatched");
    }),
  );

  it.live("logs failed request conversion once and retains the native 400 response", () =>
    Effect.gen(function* () {
      const invalidRequest = HttpServerRequest.fromClientRequest(
        HttpClientRequest.get("/private-password").pipe(HttpClientRequest.setHeader("host", "[")),
      );
      const { event, response } = yield* captureInvocation(invokeRequest(invalidRequest, config));
      assert.strictEqual(response.status, 400);
      assert.strictEqual(event.status, "error");
      assert.strictEqual(event.errorType, "Defect");
    }),
  );

  it.live("logs synchronous AWS runtime decoder defects once", () =>
    Effect.acquireUseRelease(
      Effect.sync(() =>
        vi.spyOn(AwsEnvironment, "readAwsRuntime").mockImplementationOnce(throwDecoderDefect),
      ),
      () =>
        Effect.gen(function* () {
          const { event, response } = yield* captureInvocation(invoke("/missing", config));
          assert.strictEqual(response.status, 500);
          assert.strictEqual(event.status, "error");
          assert.strictEqual(event.errorType, "Defect");
        }),
      (mock) => Effect.sync(() => mock.mockRestore()),
    ),
  );

  it.live("reuses the outer boundary for routed requests instead of emitting twice", () =>
    Effect.gen(function* () {
      const { event, response } = yield* captureInvocation(invoke("/api/auth/get-session", config));
      assert.strictEqual(response.status, 503);
      assert.strictEqual(event.status, "ok");
      assert.strictEqual(event.route_kind, "auth");
      assert.strictEqual(event.http_status, 503);
      const webResponse = HttpServerResponse.toWeb(response);
      assert.strictEqual(
        yield* Effect.promise(() => webResponse.text()),
        "Better Auth is unavailable. Configure BETTER_AUTH_SECRET.",
      );
    }),
  );

  it.live("retains typed failure classification at the Lambda boundary", () =>
    Effect.acquireUseRelease(
      Effect.sync(() =>
        vi
          .spyOn(AwsRouting, "routeAwsRequest")
          .mockImplementationOnce(() => Effect.fail({ message: "private-password" })),
      ),
      () =>
        Effect.gen(function* () {
          const { event, response } = yield* captureInvocation(invoke("/api/orders", config));
          assert.strictEqual(response.status, 500);
          assert.strictEqual(event.status, "error");
          assert.strictEqual(event.errorType, "Failure");
        }),
      (mock) => Effect.sync(() => mock.mockRestore()),
    ),
  );

  it.live("keeps Lambda output as flat JSON with OTLP enabled and exports once", () =>
    Effect.acquireUseRelease(
      Effect.sync(() =>
        vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}")),
      ),
      (fetch) =>
        Effect.gen(function* () {
          const { event, response } = yield* captureInvocation(
            invoke("/missing", {
              ...config,
              OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector.example",
            }),
          );
          assert.strictEqual(response.status, 404);
          assert.strictEqual(event.status, "ok");
          const calls = yield* Schema.decodeUnknownEffect(
            Schema.Array(Schema.Tuple([Schema.instanceOf(URL), Schema.Unknown])),
          )(fetch.mock.calls);
          assert.strictEqual(calls.filter(([url]) => url.pathname === "/v1/logs").length, 1);
        }),
      (fetch) => Effect.sync(() => fetch.mockRestore()),
    ),
  );
});

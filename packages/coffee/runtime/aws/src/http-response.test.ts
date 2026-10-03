import { assert, it } from "@effect/vitest";
import { safeHttpEffect } from "alchemy/Http";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { vi } from "vitest";
import { createHttpRouter } from "@effect-coffee-shop/http-routing/router";
import { HttpObservabilityLive } from "@effect-coffee-shop/http-routing/observability";
import { toLambdaHttpResponse } from "./http-response.ts";

it.effect("preserves successful Lambda responses", () =>
  Effect.gen(function* () {
    const response = HttpServerResponse.text("coffee", { status: 201 });
    assert.strictEqual(yield* toLambdaHttpResponse(Effect.succeed(response)), response);
  }),
);

it.live("returns Alchemy's 500 response with one sanitized event and no raw-cause log", () =>
  Effect.acquireUseRelease(
    Effect.sync(() => vi.spyOn(console, "log").mockImplementation(() => {})),
    (consoleLog) =>
      Effect.gen(function* () {
        const request = new Request("https://coffee.example/api/orders?token=secret");
        const router = createHttpRouter([
          {
            name: "api",
            matches: () => true,
            handle: () => Effect.fail({ message: "private database password" }),
          },
        ]);
        const response = yield* safeHttpEffect(
          router(request, undefined).pipe(
            Effect.map(HttpServerResponse.fromWeb),
            Effect.orDie,
            toLambdaHttpResponse,
          ),
        ).pipe(
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            HttpServerRequest.fromWeb(request),
          ),
          Effect.provide(HttpObservabilityLive),
          Effect.scoped,
        );
        assert.strictEqual(response.status, 500);
        const calls = yield* Schema.decodeUnknownEffect(
          Schema.Tuple([Schema.Tuple([Schema.String])]),
        )(consoleLog.mock.calls);
        assert.strictEqual(calls[0][0].includes("private database password"), false);
        const event = yield* Schema.decodeEffect(
          Schema.fromJsonString(
            Schema.Struct({
              event: Schema.Literal("http_routing.request"),
              status: Schema.Literal("error"),
              errorType: Schema.Literal("Failure"),
              errorMessage: Schema.Literal("HTTP request failed"),
            }),
          ),
        )(calls[0][0]);
        assert.strictEqual(event.status, "error");
      }),
    (consoleLog) => Effect.sync(() => consoleLog.mockRestore()),
  ),
);

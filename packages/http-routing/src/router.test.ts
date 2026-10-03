import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as HashSet from "effect/HashSet";
import * as Inspectable from "effect/Inspectable";
import * as Metric from "effect/Metric";
import * as MutableRef from "effect/MutableRef";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { WideEvent, WideEventLogger, type LogEvent } from "effect-wide-event";
import { createHttpRouter } from "./router.ts";
import { routeResponse, type HttpRouteEffect } from "./route.ts";

const RequestEvent = Schema.Struct({
  event: Schema.Literal("http_routing.request"),
  service: Schema.Literal("http-routing"),
  method: Schema.String,
  path: Schema.optional(Schema.String),
  requestId: Schema.String,
  route_kind: Schema.String,
  status: Schema.Literals(["ok", "error"]),
  durationMs: Schema.Finite,
  timestamp: Schema.String,
  traceId: Schema.String,
  spanId: Schema.String,
  http_status: Schema.optional(Schema.Finite),
  outcome: Schema.optional(Schema.Literals(["ok", "warning", "domain_error"])),
  errorType: Schema.optional(Schema.String),
  errorMessage: Schema.optional(Schema.String),
  cache_hit: Schema.optional(Schema.Boolean),
});

const readEvents = (captured: MutableRef.MutableRef<Array<LogEvent>>) =>
  Schema.decodeUnknownEffect(Schema.Array(RequestEvent))(
    MutableRef.get(captured).map((event) => event.annotations),
  );

const makeRouter = (handle: () => HttpRouteEffect, name = "api") =>
  createHttpRouter([{ name, matches: () => true, handle }]);

const throwMatcherDefect = (): boolean => {
  throw { message: "secret matcher" };
};

const request = () => new Request("https://coffee.example/api/menu");

describe("HTTP wide events", () => {
  it.effect("emits one event and preserves the response and trusted route fields", () => {
    const captured = MutableRef.make<Array<LogEvent>>([]);
    const response = new Response("coffee", { status: 201, headers: { "x-coffee": "latte" } });
    const route = makeRouter(() =>
      Effect.succeed(
        routeResponse(response, { cache_hit: true, event: "override", http_status: 999 }),
      ),
    );

    return Effect.gen(function* () {
      const routed = yield* route(request(), undefined);
      assert.strictEqual(routed.body, response.body);
      assert.strictEqual(routed.status, response.status);
      assert.strictEqual(routed.headers.get("x-coffee"), "latte");
      assert.strictEqual(response.bodyUsed, false);
      const events = yield* readEvents(captured);
      assert.strictEqual(events.length, 1);
      assert.deepStrictEqual(
        events.map(({ status, http_status, route_kind, outcome, cache_hit }) => ({
          status,
          http_status,
          route_kind,
          outcome,
          cache_hit,
        })),
        [{ status: "ok", http_status: 201, route_kind: "api", outcome: "ok", cache_hit: true }],
      );
      assert.match(events[0]?.requestId ?? "", /^[0-9a-f-]{36}$/);
      assert.strictEqual(routed.headers.get("x-request-id"), events[0]?.requestId);
      assert.strictEqual(yield* Effect.promise(() => response.text()), "coffee");
    }).pipe(Effect.provide(WideEventLogger.Capture(captured)));
  });

  it.effect(
    "adds a correlation header to immutable responses while retaining redirect headers",
    () => {
      const captured = MutableRef.make<Array<LogEvent>>([]);
      const response = Response.redirect("https://coffee.example/menu", 302);
      return Effect.gen(function* () {
        const routed = yield* makeRouter(() => Effect.succeed(routeResponse(response)))(
          request(),
          undefined,
        );
        const events = yield* readEvents(captured);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(routed.headers.get("x-request-id"), events[0]?.requestId);
        assert.strictEqual(routed.status, 302);
        assert.strictEqual(routed.headers.get("location"), response.headers.get("location"));
        assert.strictEqual(response.headers.has("x-request-id"), false);
      }).pipe(Effect.provide(WideEventLogger.Capture(captured)));
    },
  );

  it.effect("logs unmatched requests once and retains the 404 response", () => {
    const captured = MutableRef.make<Array<LogEvent>>([]);
    return Effect.gen(function* () {
      const response = yield* createHttpRouter([])(request(), undefined);
      assert.strictEqual(response.status, 404);
      assert.strictEqual(yield* Effect.promise(() => response.text()), "Not Found");
      const events = yield* readEvents(captured);
      assert.deepStrictEqual(
        events.map(({ route_kind, http_status, status, outcome }) => ({
          route_kind,
          http_status,
          status,
          outcome,
        })),
        [{ route_kind: "unmatched", http_status: 404, status: "ok", outcome: "warning" }],
      );
    }).pipe(Effect.provide(WideEventLogger.Capture(captured)));
  });

  it.effect("classifies returned HTTP errors without changing their transport success", () => {
    const captured = MutableRef.make<Array<LogEvent>>([]);
    return Effect.gen(function* () {
      yield* Effect.forEach(
        [401, 403, 500, 503],
        (status) =>
          Effect.gen(function* () {
            const response = new Response("denied", { status });
            const routed = yield* makeRouter(() => Effect.succeed(routeResponse(response)))(
              request(),
              undefined,
            );
            assert.strictEqual(routed.status, response.status);
            assert.strictEqual(routed.body, response.body);
          }),
        { concurrency: 1 },
      );
      const events = yield* readEvents(captured);
      assert.deepStrictEqual(
        events.map(({ http_status, status, outcome }) => ({ http_status, status, outcome })),
        [
          { http_status: 401, status: "ok", outcome: "warning" },
          { http_status: 403, status: "ok", outcome: "warning" },
          { http_status: 500, status: "ok", outcome: "domain_error" },
          { http_status: 503, status: "ok", outcome: "domain_error" },
        ],
      );
    }).pipe(Effect.provide(WideEventLogger.Capture(captured)));
  });

  it.effect("preserves typed failures while excluding secrets from the event", () => {
    const captured = MutableRef.make<Array<LogEvent>>([]);
    const secret = "private-password";
    const failure = { message: secret, databaseUrl: `postgres://user:${secret}@host/db` };
    const sensitiveRequest = new Request(
      `https://coffee.example/api/reset-password/${secret}?token=${secret}#${secret}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          cookie: `session=${secret}`,
          "cf-ray": secret,
          "x-amzn-trace-id": secret,
        },
        body: secret,
      },
    );
    return Effect.gen(function* () {
      assert.strictEqual(
        yield* makeRouter(() => Effect.fail(failure))(sensitiveRequest, { secret }).pipe(
          Effect.flip,
        ),
        failure,
      );
      const events = yield* readEvents(captured);
      assert.deepStrictEqual(
        events.map(({ status, errorType, errorMessage, path }) => ({
          status,
          errorType,
          errorMessage,
          path,
        })),
        [
          {
            status: "error",
            errorType: "Failure",
            errorMessage: "HTTP request failed",
            path: undefined,
          },
        ],
      );
      assert.strictEqual(
        Inspectable.toStringUnknown(MutableRef.get(captured), 0).includes(secret),
        false,
      );
    }).pipe(Effect.provide(WideEventLogger.Capture(captured)));
  });

  it.effect("emits once for defects and preserves the original cause", () => {
    const captured = MutableRef.make<Array<LogEvent>>([]);
    const defect = { message: "secret database credentials" };
    return Effect.gen(function* () {
      const exit = yield* makeRouter(() => Effect.die(defect))(request(), undefined).pipe(
        Effect.exit,
      );
      assert.strictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit))
        Result.match(Cause.findDefect(exit.cause), {
          onSuccess: (value) => assert.strictEqual(value, defect),
          onFailure: () => assert.fail("Expected the original defect"),
        });
      const events = yield* readEvents(captured);
      assert.deepStrictEqual(
        events.map(({ status, errorType }) => ({ status, errorType })),
        [{ status: "error", errorType: "Defect" }],
      );
      assert.strictEqual(
        Inspectable.toStringUnknown(MutableRef.get(captured), 0).includes(defect.message),
        false,
      );
    }).pipe(Effect.provide(WideEventLogger.Capture(captured)));
  });

  it.effect("captures synchronous route defects inside the boundary", () => {
    const captured = MutableRef.make<Array<LogEvent>>([]);
    return Effect.gen(function* () {
      const route = createHttpRouter([
        {
          name: "broken",
          matches: throwMatcherDefect,
          handle: () => Effect.succeed(routeResponse(new Response())),
        },
      ]);
      const exit = yield* route(request(), undefined).pipe(Effect.exit);
      assert.strictEqual(Exit.isFailure(exit), true);
      const events = yield* readEvents(captured);
      assert.deepStrictEqual(
        events.map(({ status, errorType }) => ({ status, errorType })),
        [{ status: "error", errorType: "Defect" }],
      );
      assert.strictEqual(
        Inspectable.toStringUnknown(MutableRef.get(captured), 0).includes("secret matcher"),
        false,
      );
    }).pipe(Effect.provide(WideEventLogger.Capture(captured)));
  });

  it.effect("emits once after interruption", () => {
    const captured = MutableRef.make<Array<LogEvent>>([]);
    return Effect.gen(function* () {
      const entered = yield* Deferred.make<void>();
      const route = makeRouter(() =>
        Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)),
      );
      const fiber = yield* route(request(), undefined).pipe(Effect.forkChild);
      yield* Deferred.await(entered);
      yield* Fiber.interrupt(fiber);
      const exit = yield* Fiber.await(fiber);
      assert.strictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) assert.strictEqual(Cause.hasInterrupts(exit.cause), true);
      const events = yield* readEvents(captured);
      assert.deepStrictEqual(
        events.map(({ status, errorType }) => ({ status, errorType })),
        [{ status: "error", errorType: "Interrupted" }],
      );
    }).pipe(Effect.provide(WideEventLogger.Capture(captured)));
  });

  it.effect("isolates concurrent requests and allocates a new event on each execution", () => {
    const captured = MutableRef.make<Array<LogEvent>>([]);
    return Effect.gen(function* () {
      const entered = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const slow = makeRouter(
        () =>
          Effect.gen(function* () {
            yield* WideEvent.setOptional({ cache_hit: true });
            yield* Deferred.succeed(entered, undefined);
            yield* Deferred.await(release);
            return routeResponse(new Response());
          }),
        "slow",
      );
      const fast = makeRouter(() => Effect.succeed(routeResponse(new Response())), "fast");
      const slowFiber = yield* slow(request(), undefined).pipe(Effect.forkChild);
      yield* Deferred.await(entered);
      const fastRequest = fast(request(), undefined);
      yield* fastRequest;
      yield* fastRequest;
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(slowFiber);
      const events = yield* readEvents(captured);
      assert.deepStrictEqual(
        events.map(({ route_kind, cache_hit }) => ({ route_kind, cache_hit })),
        [
          { route_kind: "fast", cache_hit: undefined },
          { route_kind: "fast", cache_hit: undefined },
          { route_kind: "slow", cache_hit: true },
        ],
      );
      assert.strictEqual(
        HashSet.size(HashSet.fromIterable(events.map((event) => event.requestId))),
        3,
      );
    }).pipe(Effect.provide(WideEventLogger.Capture(captured)));
  });

  it.effect("retains request metrics and counts defects as failures exactly once", () => {
    const captured = MutableRef.make<Array<LogEvent>>([]);
    const failureAttributes = {
      http_method: "GET",
      route_kind: "metric-failure",
      outcome: "error",
    };
    const failedRequests = Metric.withAttributes(
      Metric.counter("http_routing_requests_total", {
        description: "Total HTTP routing requests handled by route, method, and outcome.",
        incremental: true,
      }),
      failureAttributes,
    );
    const failures = Metric.withAttributes(
      Metric.counter("http_routing_request_failures_total", {
        description: "Total HTTP routing request failures by route and method.",
        incremental: true,
      }),
      failureAttributes,
    );
    const completedRequests = Metric.withAttributes(
      Metric.counter("http_routing_requests_total", {
        description: "Total HTTP routing requests handled by route, method, and outcome.",
        incremental: true,
      }),
      {
        http_method: "GET",
        route_kind: "metric-success",
        outcome: "success",
        http_status: "503",
      },
    );
    return Effect.gen(function* () {
      const failedBefore = yield* Metric.value(failedRequests);
      const failuresBefore = yield* Metric.value(failures);
      const completedBefore = yield* Metric.value(completedRequests);
      yield* makeRouter(() => Effect.die("private defect"), "metric-failure")(
        request(),
        undefined,
      ).pipe(Effect.exit);
      yield* makeRouter(
        () => Effect.succeed(routeResponse(new Response("unavailable", { status: 503 }))),
        "metric-success",
      )(request(), undefined);
      assert.strictEqual((yield* Metric.value(failedRequests)).count - failedBefore.count, 1);
      assert.strictEqual((yield* Metric.value(failures)).count - failuresBefore.count, 1);
      assert.strictEqual((yield* Metric.value(completedRequests)).count - completedBefore.count, 1);
      assert.strictEqual((yield* readEvents(captured)).length, 2);
    }).pipe(Effect.provide(WideEventLogger.Capture(captured)));
  });
});

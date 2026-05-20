import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Metric from "effect/Metric";
import * as Option from "effect/Option";
import { FetchHttpClient } from "effect/unstable/http";
import { Otlp } from "effect/unstable/observability";

const serviceName = "effect-coffee-shop";
const nonBlankString = Option.filter((value: string) => value.trim().length > 0);

const ConsoleObservabilityLive = Layer.mergeAll(
  Logger.layer([Logger.consoleJson], { mergeWithExisting: true }),
  Metric.enableRuntimeMetricsLayer,
);

const makeOtlpObservabilityLayer = (baseUrl: string) =>
  Otlp.layerJson({
    baseUrl,
    resource: {
      serviceName,
    },
  }).pipe(Layer.provide(FetchHttpClient.layer));

const resolveOtlpObservabilityLayer = (endpoint: Option.Option<string>) =>
  Option.match(endpoint, {
    onNone: () => Layer.empty,
    onSome: makeOtlpObservabilityLayer,
  });

const OtlpObservabilityLive = Layer.unwrap(
  Config.option(Config.string("OTEL_EXPORTER_OTLP_ENDPOINT")).pipe(
    Effect.map(nonBlankString),
    Effect.map(resolveOtlpObservabilityLayer),
  ),
);

export const HostObservabilityLive = Layer.mergeAll(
  ConsoleObservabilityLive,
  OtlpObservabilityLive,
);

const requestTotal = Metric.counter("worker_requests_total", {
  description: "Total Cloudflare worker requests handled by route, method, and outcome.",
  incremental: true,
});

const requestFailureTotal = Metric.counter("worker_request_failures_total", {
  description: "Total Cloudflare worker request failures by route and method.",
  incremental: true,
});

const requestDurationMs = Metric.histogram("worker_request_duration_ms", {
  description: "Cloudflare worker request duration in milliseconds.",
  boundaries: Metric.exponentialBoundaries({ start: 1, factor: 2, count: 16 }),
});

type MetricAttributes = Readonly<Record<string, string>>;

export function runHostEffect<A, E>(effect: Effect.Effect<A, E>): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(HostObservabilityLive)));
}

export function recordWorkerRequestCompleted(input: {
  readonly durationMs: number;
  readonly method: string;
  readonly routeKind: string;
  readonly status: number;
}) {
  const attributes: MetricAttributes = {
    http_method: input.method,
    http_status: String(input.status),
    outcome: "success",
    route_kind: input.routeKind,
  };

  return Effect.gen(function* () {
    yield* Metric.update(Metric.withAttributes(requestTotal, attributes), 1);
    yield* Metric.update(Metric.withAttributes(requestDurationMs, attributes), input.durationMs);
  });
}

export function recordWorkerRequestFailed(input: {
  readonly durationMs: number;
  readonly method: string;
  readonly routeKind: string;
}) {
  const attributes: MetricAttributes = {
    http_method: input.method,
    outcome: "error",
    route_kind: input.routeKind,
  };

  return Effect.gen(function* () {
    yield* Metric.update(Metric.withAttributes(requestTotal, attributes), 1);
    yield* Metric.update(Metric.withAttributes(requestFailureTotal, attributes), 1);
    yield* Metric.update(Metric.withAttributes(requestDurationMs, attributes), input.durationMs);
  });
}

export function requestSpanAttributes(input: {
  readonly request: Request;
  readonly routeKind: string;
}) {
  const url = new URL(input.request.url);

  return {
    http_method: input.request.method,
    http_path: url.pathname,
    route_kind: input.routeKind,
  };
}

import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Metric from "effect/Metric";
import * as Option from "effect/Option";
import { FetchHttpClient } from "effect/unstable/http";
import { Otlp } from "effect/unstable/observability";

const defaultServiceName = "http-routing";
const nonBlankString = Option.filter((value: string) => value.trim().length > 0);

const ConsoleObservabilityLive = Layer.mergeAll(
  Logger.layer([Logger.consoleJson], { mergeWithExisting: true }),
  Metric.enableRuntimeMetricsLayer,
);

const makeOtlpObservabilityLayer = (input: {
  readonly baseUrl: string;
  readonly serviceName: string;
}) =>
  Otlp.layerJson({
    baseUrl: input.baseUrl,
    resource: {
      serviceName: input.serviceName,
    },
  }).pipe(Layer.provide(FetchHttpClient.layer));

const resolveOtlpObservabilityLayer = (input: {
  readonly endpoint: Option.Option<string>;
  readonly serviceName: string;
}) =>
  Option.match(input.endpoint, {
    onNone: () => Layer.empty,
    onSome: (baseUrl) =>
      makeOtlpObservabilityLayer({
        baseUrl,
        serviceName: input.serviceName,
      }),
  });

const resolveOtelServiceName = (serviceName: Option.Option<string>): string =>
  Option.match(nonBlankString(serviceName), {
    onNone: () => defaultServiceName,
    onSome: (value) => value,
  });

const OtlpObservabilityLive = Layer.unwrap(
  Effect.gen(function* () {
    const endpoint = yield* Config.option(Config.string("OTEL_EXPORTER_OTLP_ENDPOINT")).pipe(
      Effect.map(nonBlankString),
    );
    const serviceName = yield* Config.option(Config.string("OTEL_SERVICE_NAME")).pipe(
      Effect.map(resolveOtelServiceName),
    );

    return resolveOtlpObservabilityLayer({ endpoint, serviceName });
  }),
);

export const HttpObservabilityLive = Layer.mergeAll(
  ConsoleObservabilityLive,
  OtlpObservabilityLive,
);

const HttpObservabilityRuntime = ManagedRuntime.make(HttpObservabilityLive);

const requestTotal = Metric.counter("http_routing_requests_total", {
  description: "Total HTTP routing requests handled by route, method, and outcome.",
  incremental: true,
});

const requestFailureTotal = Metric.counter("http_routing_request_failures_total", {
  description: "Total HTTP routing request failures by route and method.",
  incremental: true,
});

const requestDurationMs = Metric.histogram("http_routing_request_duration_ms", {
  description: "HTTP routing request duration in milliseconds.",
  boundaries: Metric.exponentialBoundaries({ start: 1, factor: 2, count: 16 }),
});

type MetricAttributes = Readonly<Record<string, string>>;

export const runHttpEffect = HttpObservabilityRuntime.runPromise;

export const recordHttpRequestCompleted = (input: {
  readonly durationMs: number;
  readonly method: string;
  readonly routeKind: string;
  readonly status: number;
}) => {
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
};

export const recordHttpRequestFailed = (input: {
  readonly durationMs: number;
  readonly method: string;
  readonly routeKind: string;
}) => {
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
};

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

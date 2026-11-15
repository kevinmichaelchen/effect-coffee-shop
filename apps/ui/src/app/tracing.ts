/**
 * Where the app's spans go: the Coffee Worker's OTLP relay, on the app's own
 * origin. The Worker forwards each batch to its own telemetry destinations
 * with its own credentials, so no ingest token reaches a browser.
 *
 * Unset (local dev, tests, and any deployment that has not configured it)
 * leaves Effect's default no-op tracer in place: nothing is recorded and
 * nothing is exported.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { HttpClient } from "effect/http";
import * as OtlpSerialization from "effect/observability/OtlpSerialization";
import * as OtlpTracer from "effect/observability/OtlpTracer";
import { Http } from "foldkit";

/** The Worker route the browser posts spans to, if tracing is configured. */
const traceUrl = Option.fromNullishOr(import.meta.env.VITE_COFFEE_TRACE_URL);

/**
 * The tracers this app may have: none when no relay is configured, otherwise
 * an OTLP exporter to that URL. Provided last in `resources`, so its HTTP
 * settings win when it is on.
 */
const tracingFor = (url: Option.Option<string>) =>
  Option.match(url, {
    onNone: () => Layer.empty,
    onSome: (url) =>
      Layer.merge(
        OtlpTracer.layer({ url, resource: { serviceName: "coffee-shop-web" } }).pipe(
          Layer.provide(Layer.merge(OtlpSerialization.layerJson, Http.layer)),
        ),
        // The app talks only to its own origin, where a traceparent on the
        // request is what lets the Worker continue the browser's trace.
        Layer.succeed(HttpClient.TracerPropagationEnabled, true),
      ),
  });

/** The app's tracer. */
export const Tracing = tracingFor(traceUrl);

/**
 * Browser telemetry, collected through the Coffee Worker. The app exports its
 * OTLP spans to its own origin; this receiver forwards each batch to the same
 * destinations the Worker exports its own spans to, with the Worker's
 * credentials, so no ingest token is ever shipped to a browser.
 *
 * Cloudflare's Workers Observability records only a Worker's own spans, so a
 * backend configured through `Cloudflare.Telemetry()` reports the Worker's
 * side of a flow; point a destination (e.g. `Alchemy.Telemetry.layerOtlp`) at
 * an OTLP backend to keep the whole trace, browser spans included.
 *
 * @module
 */
import * as Telemetry from "alchemy/Telemetry";
import * as Layer from "effect/Layer";
import { TelemetryRelay } from "../../CoffeeServer.ts";

/** The Worker's own telemetry destinations, reachable as the browser's OTLP relay. */
export const TelemetryRelayLive = Layer.succeed(TelemetryRelay, {
  receive: (authorize) => Telemetry.relay({ signals: ["traces"], authorize }),
});

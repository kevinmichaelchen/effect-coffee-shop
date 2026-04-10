# Cloudflare OTel Collector

This directory holds the first repo-level foundation for exporting Cloudflare
telemetry through an OpenTelemetry Collector that runs on Cloudflare
Containers.

## Decision

Use Cloudflare Containers for an OpenTelemetry Collector ingress layer.

Do not try to run the full self-hosted SigNoz stack on Cloudflare Containers.

## Why

Cloudflare Containers are a good fit for the Collector:

- the Collector is mostly stateless
- Cloudflare AI Gateway exports traces to endpoints that accept `OTLP/JSON`
- the upstream OpenTelemetry Collector OTLP receiver accepts HTTP/JSON on
  `/v1/traces`, `/v1/logs`, and `/v1/metrics`
- a Collector gives us auth, batching, fan-out, filtering, and protocol
  translation between Cloudflare and whichever backend we choose

Cloudflare Containers are a poor fit for full SigNoz today:

- Cloudflare says container disk is ephemeral
- Cloudflare says persistent disk is still exploratory and not slated for the
  near term
- Cloudflare Containers are still in beta
- Cloudflare's current scaling and routing story is still transitional, with
  native autoscaling/load balancing called out as unreleased or upcoming
- SigNoz's own architecture depends on ClickHouse and additional services,
  rather than a single stateless container

That makes the cleaner split:

`Cloudflare Workers + AI Gateway -> Collector on Cloudflare Containers -> SigNoz elsewhere`

## Scope Of This Slice

This branch does not try to automate Cloudflare Container provisioning yet.
The installed Alchemy version in this repo does not expose a first-class
Cloudflare Containers resource, so the next implementation slice will likely be
a small standalone Wrangler project or companion deployment path.

This directory currently includes:

- a container image definition for `otel/opentelemetry-collector-contrib`
- a minimal collector config that accepts OTLP over HTTP and forwards traces
  and logs upstream
- an env example for wiring the upstream backend

## Planned Next Step

Add a small Cloudflare Containers Worker that:

1. exposes an OTLP HTTP ingress endpoint
2. proxies `/v1/traces` and `/v1/logs` to the collector container
3. mounts the collector on a separate hostname or path from the main app
4. becomes the target for Cloudflare Workers OTLP export and AI Gateway OTEL

## Notes For SigNoz

If the upstream backend is SigNoz:

- self-hosted SigNoz typically exposes OTLP gRPC on `:4317` and OTLP HTTP on
  `:4318`
- SigNoz docs explicitly support placing your own Collector in front of SigNoz
- for Cloudflare AI Gateway, an OTLP HTTP path is the safer initial target

This means the simplest first upstream wiring is:

`otlphttp exporter -> http://<signoz-host>:4318`

## Sources

- Cloudflare Containers overview:
  https://developers.cloudflare.com/containers/
- Cloudflare Containers getting started:
  https://developers.cloudflare.com/containers/get-started
- Cloudflare Containers scaling and routing:
  https://developers.cloudflare.com/containers/platform-details/scaling-and-routing/
- Cloudflare Containers FAQ:
  https://developers.cloudflare.com/containers/faq/
- Cloudflare Containers beta info:
  https://developers.cloudflare.com/containers/beta-info/
- Cloudflare Workers OTel export:
  https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/
- Cloudflare AI Gateway OTel integration:
  https://developers.cloudflare.com/ai-gateway/observability/otel-integration/
- OpenTelemetry Collector:
  https://opentelemetry.io/docs/collector/
- OpenTelemetry OTLP receiver:
  https://github.com/open-telemetry/opentelemetry-collector/blob/main/receiver/otlpreceiver/README.md
- SigNoz architecture:
  https://signoz.io/docs/architecture/
- SigNoz self-hosted ingestion:
  https://signoz.io/docs/ingestion/self-hosted/overview/

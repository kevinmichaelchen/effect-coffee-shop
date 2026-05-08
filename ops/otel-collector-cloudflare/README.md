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

This repo includes the original companion Worker/container files, but the
Alchemy v2 migration currently does not provision the Collector container. The
v2 stack in this directory only manages the Cloudflare Workers Observability
destination resources and points them at an already-running collector ingress
URL.

Set `OTEL_COLLECTOR_INGRESS_URL` to that existing ingress origin, for example
`https://<collector-worker>.<account>.workers.dev`.

This directory currently includes:

- a container image definition for `otel/opentelemetry-collector-contrib`
- a minimal collector config that accepts OTLP over HTTP and forwards traces
  and logs upstream
- collector-side redaction for `gen_ai.prompt_json` and
  `gen_ai.completion_json` before upstream export
- legacy Worker/container source for the Cloudflare Container ingress
- a v2 Alchemy stack that manages trace/log destination resources
- a local `.env.example` for wiring the upstream backend
- a companion [`alchemy.run.ts`](./alchemy.run.ts) for destination
  deploy/destroy

## Companion Worker

The companion Worker lives in [`worker/`](./worker) and provides:

1. one `Container` class backed by a single Durable Object / container instance
2. one OTLP ingress surface for `POST /v1/traces` and `POST /v1/logs`
3. one simple `/healthz` endpoint for worker-level liveness checks
4. one Alchemy deployment path independent of the main app

The Worker is small on purpose. It now supports optional shared-secret auth on
ingress requests, but it does not try to add routing fan-out, load balancing,
or Effect-specific abstractions yet.

## Local Workflow

```bash
cp ops/otel-collector-cloudflare/.env.example ops/otel-collector-cloudflare/.env.local
bun install
bun run check
bun run cf:deploy:otel-collector -- --env-file ./ops/otel-collector-cloudflare/.env.local
```

`bun run cf:deploy:otel-collector` does not currently build or deploy the
Collector container under Alchemy v2. It requires `OTEL_COLLECTOR_INGRESS_URL`
to point at an already-running ingress that accepts `POST /v1/traces` and
`POST /v1/logs`.

If you are running the legacy companion ingress yourself, set
`UPSTREAM_OTLP_HTTP_ENDPOINT` in that Worker/container environment to the OTLP
HTTP base path for your backend, such as `https://<signoz-host>:4318/v1`.

If your upstream requires an auth header, set
`UPSTREAM_OTLP_AUTHORIZATION=Bearer ...` in that Worker/container environment.

Set `OTEL_INGRESS_AUTHORIZATION=Bearer ...` to require the same authorization
header on telemetry export requests that hit the ingress Worker.
When this is set, the Alchemy destination resources will attach the matching
`Authorization` header automatically for Workers observability exports.
This is the recommended baseline hardening for the ingress path.

The collector also deletes `gen_ai.prompt_json` and `gen_ai.completion_json`
attributes before forwarding telemetry upstream.
That matches the Cloudflare AI Gateway OTEL attribute names for raw prompt and
completion payloads, so future AI Gateway exports do not leak those fields by
default.

Set `CLOUDFLARE_OBSERVABILITY_API_TOKEN` to an account-level Cloudflare API
token with `Workers Observability Write` permission.
The current Alchemy Cloudflare OAuth flow is enough to deploy Workers and
Containers, but not enough to create Workers Observability destinations through
the API.

## Deployment Shape

From the repo root:

```bash
bun install
bun run cf:deploy:otel-collector -- --profile default --env-file ./ops/otel-collector-cloudflare/.env.local
```

Alchemy will:

1. create trace/log destination resources that point at
   `OTEL_COLLECTOR_INGRESS_URL`
2. attach the optional `OTEL_INGRESS_AUTHORIZATION` header to those
   destinations
3. manage this destination state separately from the main coffee-shop app

After deploy, point Cloudflare Workers OTLP export and AI Gateway OTEL at the
same collector ingress URL, not at the container directly.

Verification note:

- On April 11, 2026, live repo traffic verified Cloudflare delivery into this
  ingress path.
- The destination resources reported successful completion for both
  `opentelemetry-traces` and `opentelemetry-logs`.
- Cloudflare telemetry queries also showed the ingress Worker receiving
  `POST /v1/logs` after real requests hit the main app Worker.
- The collector config now strips `gen_ai.prompt_json` and
  `gen_ai.completion_json` before upstream export.

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

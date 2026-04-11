import alchemy from "alchemy";
import { Container, Worker } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";

import {
  collectorLogDestinationName,
  collectorTraceDestinationName,
} from "./destination-names.ts";
import { WorkersObservabilityDestination } from "./observability-destination.ts";

const app = await alchemy("effect-v4-onion-otel", {
  password: process.env.ALCHEMY_PASSWORD,
  stateStore: process.env.ALCHEMY_STATE_TOKEN
    ? (scope) => new CloudflareStateStore(scope)
    : undefined,
});
const observabilityApiToken =
  process.env.CLOUDFLARE_OBSERVABILITY_API_TOKEN?.trim();

export const collector = await Container("collector", {
  build: {
    context: "./ops/otel-collector-cloudflare",
    dockerfile: "Dockerfile",
    platform: "linux/amd64",
  },
  className: "OtelCollectorContainer",
  maxInstances: 1,
});

export const ingress = await Worker("ingress", {
  bindings: {
    OTEL_COLLECTOR: collector,
    UPSTREAM_OTLP_AUTHORIZATION: process.env.UPSTREAM_OTLP_AUTHORIZATION
      ? alchemy.secret(process.env.UPSTREAM_OTLP_AUTHORIZATION)
      : "",
    UPSTREAM_OTLP_HTTP_ENDPOINT: process.env.UPSTREAM_OTLP_HTTP_ENDPOINT ?? "",
  },
  cwd: "./ops/otel-collector-cloudflare/worker",
  entrypoint: "./src/index.ts",
  observability: {
    enabled: true,
    headSamplingRate: 1,
    logs: {
      enabled: true,
      headSamplingRate: 1,
      invocationLogs: true,
      persist: true,
    },
    traces: {
      enabled: true,
      headSamplingRate: 1,
      persist: true,
    },
  },
  url: true,
});

export const tracesDestination = await WorkersObservabilityDestination(
  "traces-destination",
  {
    apiToken: observabilityApiToken
      ? alchemy.secret(observabilityApiToken)
      : undefined,
    dataset: "opentelemetry-traces",
    name: collectorTraceDestinationName(),
    url: `${ingress.url}/v1/traces`,
  },
);

export const logsDestination = await WorkersObservabilityDestination(
  "logs-destination",
  {
    apiToken: observabilityApiToken
      ? alchemy.secret(observabilityApiToken)
      : undefined,
    dataset: "opentelemetry-logs",
    name: collectorLogDestinationName(),
    url: `${ingress.url}/v1/logs`,
  },
);

console.log({
  collector: collector.name,
  logsDestination: logsDestination.name,
  observabilityApiTokenConfigured: observabilityApiToken !== undefined,
  tracesDestination: tracesDestination.name,
  url: ingress.url,
});

await app.finalize();

import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import type { OtelCollectorContainer } from "./worker/src/index.ts";
import {
  collectorLogDestinationName,
  collectorTraceDestinationName,
} from "./destination-names.ts";
import {
  WorkersObservabilityDestination,
  WorkersObservabilityDestinationProvider,
} from "./observability-destination.ts";

const optionalSecret = (value: string | undefined) =>
  value === undefined || value.trim().length === 0
    ? ""
    : Redacted.make(value);

const state = () =>
  process.env.ALCHEMY_STATE_TOKEN
    ? Cloudflare.state()
    : Alchemy.localState();

const cloudflareProviders = Cloudflare.providers();

const providers = Layer.merge(
  cloudflareProviders,
  WorkersObservabilityDestinationProvider().pipe(
    Layer.provide(cloudflareProviders),
  ),
);

export default Alchemy.Stack(
  "effect-v4-onion-otel",
  {
    providers,
    state: state(),
  },
  Effect.gen(function* () {
    const observabilityApiToken =
      process.env.CLOUDFLARE_OBSERVABILITY_API_TOKEN?.trim();
    const ingressAuthorization = process.env.OTEL_INGRESS_AUTHORIZATION?.trim();
    const destinationHeaders: ReadonlyArray<readonly [string, string]> =
      ingressAuthorization === undefined || ingressAuthorization.length === 0
        ? []
        : [["Authorization", ingressAuthorization]];

    const collectorNamespace =
      Cloudflare.DurableObjectNamespace<OtelCollectorContainer>(
        "OTEL_COLLECTOR",
        {
          className: "OtelCollectorContainer",
        },
      );

    const ingress = yield* Cloudflare.Worker("ingress", {
      bindings: {
        OTEL_COLLECTOR: collectorNamespace,
      },
      compatibility: {
        flags: ["nodejs_compat"],
      },
      env: {
        OTEL_INGRESS_AUTHORIZATION: optionalSecret(ingressAuthorization),
        UPSTREAM_OTLP_AUTHORIZATION: optionalSecret(
          process.env.UPSTREAM_OTLP_AUTHORIZATION,
        ),
        UPSTREAM_OTLP_HTTP_ENDPOINT:
          process.env.UPSTREAM_OTLP_HTTP_ENDPOINT ?? "",
      },
      main: "./ops/otel-collector-cloudflare/worker/src/index.ts",
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

    yield* ingress.bind("OtelCollectorContainer", {
      containers: [{ className: "OtelCollectorContainer" }],
    });

    const tracesDestination = yield* WorkersObservabilityDestination(
      "traces-destination",
      {
        apiToken: observabilityApiToken
          ? Redacted.make(observabilityApiToken)
          : undefined,
        dataset: "opentelemetry-traces",
        headers: destinationHeaders,
        name: collectorTraceDestinationName(),
        url: `${ingress.url}/v1/traces`,
      },
    );

    const logsDestination = yield* WorkersObservabilityDestination(
      "logs-destination",
      {
        apiToken: observabilityApiToken
          ? Redacted.make(observabilityApiToken)
          : undefined,
        dataset: "opentelemetry-logs",
        headers: destinationHeaders,
        name: collectorLogDestinationName(),
        url: `${ingress.url}/v1/logs`,
      },
    );

    return {
      collector: "OtelCollectorContainer",
      ingressAuthorizationConfigured: ingressAuthorization !== undefined,
      logsDestination: logsDestination.name,
      observabilityApiTokenConfigured: observabilityApiToken !== undefined,
      tracesDestination: tracesDestination.name,
      url: ingress.url,
    };
  }),
);

import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import {
  collectorLogDestinationName,
  collectorTraceDestinationName,
} from "./destination-names.ts";
import {
  WorkersObservabilityDestination,
  WorkersObservabilityDestinationProvider,
} from "./observability-destination.ts";

const state = () =>
  process.env.ALCHEMY_STATE_TOKEN
    ? Cloudflare.state()
    : Alchemy.localState();

const requireIngressUrl = () =>
  Effect.gen(function* () {
    const value = process.env.OTEL_COLLECTOR_INGRESS_URL?.trim();
    if (value === undefined || value.length === 0) {
      return yield* Effect.die(
        new Error(
          "OTEL_COLLECTOR_INGRESS_URL is required while the OTel Collector container is not managed by Alchemy v2.",
        ),
      );
    }
    return value.replace(/\/+$/, "");
  });

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
    const ingressUrl = yield* requireIngressUrl();
    const destinationHeaders: ReadonlyArray<readonly [string, string]> =
      ingressAuthorization === undefined || ingressAuthorization.length === 0
        ? []
        : [["Authorization", ingressAuthorization]];

    const tracesDestination = yield* WorkersObservabilityDestination(
      "traces-destination",
      {
        apiToken: observabilityApiToken
          ? Redacted.make(observabilityApiToken)
          : undefined,
        dataset: "opentelemetry-traces",
        headers: destinationHeaders,
        name: collectorTraceDestinationName(),
        url: `${ingressUrl}/v1/traces`,
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
        url: `${ingressUrl}/v1/logs`,
      },
    );

    return {
      collectorManaged: false,
      ingressAuthorizationConfigured: ingressAuthorization !== undefined,
      logsDestination: logsDestination.name,
      observabilityApiTokenConfigured: observabilityApiToken !== undefined,
      tracesDestination: tracesDestination.name,
      url: ingressUrl,
    };
  }),
);

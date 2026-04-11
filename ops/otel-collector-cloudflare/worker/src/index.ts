import { Container } from "@cloudflare/containers";

type OtlpIngressPathname = "/v1/logs" | "/v1/traces";

interface Env {
  OTEL_COLLECTOR: DurableObjectNamespace<OtelCollectorContainer>;
  UPSTREAM_OTLP_AUTHORIZATION?: string;
  UPSTREAM_OTLP_HTTP_ENDPOINT: string;
}

const collectorInstanceName = "primary";

const collectorConfigurationMissing = (env: Env): boolean =>
  env.UPSTREAM_OTLP_HTTP_ENDPOINT.trim().length === 0;

const errorResponse = (error: string, status: number): Response =>
  Response.json({ error }, { status });

const okResponse = (status: string): Response => Response.json({ status });

const pathnameOf = (request: Request): string => new URL(request.url).pathname;

const isOtlpIngressPathname = (pathname: string): pathname is OtlpIngressPathname =>
  pathname === "/v1/logs" || pathname === "/v1/traces";

export class OtelCollectorContainer extends Container<Env> {
  defaultPort = 4318;

  sleepAfter = "10m";

  constructor(ctx: DurableObjectState<Env>, env: Env) {
    super(ctx, env);
    this.envVars = {
      UPSTREAM_OTLP_AUTHORIZATION: env.UPSTREAM_OTLP_AUTHORIZATION ?? "",
      UPSTREAM_OTLP_HTTP_ENDPOINT: env.UPSTREAM_OTLP_HTTP_ENDPOINT,
    };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = pathnameOf(request);

    if (pathname === "/healthz") {
      return okResponse("ok");
    }

    if (collectorConfigurationMissing(env)) {
      return errorResponse("collector upstream is not configured", 500);
    }

    if (!isOtlpIngressPathname(pathname)) {
      return errorResponse("not found", 404);
    }

    if (request.method !== "POST") {
      return errorResponse("method not allowed", 405);
    }

    const collector = env.OTEL_COLLECTOR.getByName(collectorInstanceName);
    return collector.fetch(request);
  },
} satisfies ExportedHandler<Env>;

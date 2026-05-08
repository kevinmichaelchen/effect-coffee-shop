import { build } from "esbuild";
import * as Option from "effect/Option";
import { Miniflare } from "miniflare";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

const JsonRpcIdSchema = Schema.Union([Schema.String, Schema.Number, Schema.Null]);

const JsonRpcErrorSchema = Schema.Struct({
  code: Schema.Number,
  data: Schema.optionalKey(Schema.Unknown),
  message: Schema.String,
});

const JsonRpcErrorEnvelopeSchema = Schema.Struct({
  error: JsonRpcErrorSchema,
  id: Schema.optionalKey(JsonRpcIdSchema),
  jsonrpc: Schema.Literal("2.0"),
});

const JsonRpcSuccessEnvelopeSchema = Schema.Struct({
  id: Schema.optionalKey(JsonRpcIdSchema),
  jsonrpc: Schema.Literal("2.0"),
  result: Schema.Unknown,
});

class McpMiniflareBundleError extends Schema.TaggedErrorClass<McpMiniflareBundleError>()(
  "McpMiniflareBundleError",
  {
    message: Schema.String,
  },
) {}

class McpMiniflareTransportError extends Schema.TaggedErrorClass<McpMiniflareTransportError>()(
  "McpMiniflareTransportError",
  {
    message: Schema.String,
  },
) {}

class McpJsonRpcResponseError extends Schema.TaggedErrorClass<McpJsonRpcResponseError>()(
  "McpJsonRpcResponseError",
  {
    code: Schema.Number,
    message: Schema.String,
  },
) {}

export type McpRequest = <S extends Schema.Top>(
  schema: S,
  method: string,
  params?: unknown,
  options?: {
    readonly id?: number | string;
  },
) => Effect.Effect<
  S["Type"],
  McpJsonRpcResponseError | McpMiniflareTransportError | Schema.SchemaError,
  S["DecodingServices"]
>;

export type McpMiniflareClient = {
  readonly request: McpRequest;
  readonly responses: ReadonlyArray<Response>;
  readonly resetSession: () => void;
  readonly dispose: () => Promise<void>;
};

const resolveMcpWorkerEntrypoint = Effect.fnUntraced(function* () {
  const path = yield* Path.Path;

  return yield* path.fromFileUrl(
    new URL("../../src/cloudflare/mcp-miniflare-worker.ts", import.meta.url),
  );
});

const bundleWorkerScript = Effect.fn("bundleWorkerScript")(function* () {
  const entryPoint = yield* resolveMcpWorkerEntrypoint().pipe(
    Effect.mapError(
      () =>
        new McpMiniflareBundleError({
          message: "Miniflare worker entrypoint could not be resolved.",
        }),
    ),
  );

  const result = yield* Effect.tryPromise({
    try: () =>
      build({
        bundle: true,
        entryPoints: [entryPoint],
        format: "esm",
        logLevel: "silent",
        platform: "browser",
        target: "esnext",
        write: false,
      }),
    catch: () =>
      new McpMiniflareBundleError({
        message: "Miniflare worker bundle could not be built.",
      }),
  });
  const output = result.outputFiles[0];

  if (output === undefined) {
    return yield* new McpMiniflareBundleError({
      message: "Miniflare worker bundle did not produce an output file.",
    });
  }

  return output.text;
});

const createMiniflare = (script: string): Miniflare =>
  new Miniflare({
    compatibilityDate: "2026-03-31",
    modules: true,
    script,
  });

const decodeJsonRpcSuccessEnvelope = Schema.decodeUnknownEffect(JsonRpcSuccessEnvelopeSchema);
const decodeJsonRpcErrorEnvelope = Schema.decodeUnknownOption(JsonRpcErrorEnvelopeSchema);
const encodeJsonString = Schema.encodeUnknownEffect(Schema.UnknownFromJsonString);

export const measureMcpWorkerBundle = Effect.fn("measureMcpWorkerBundle")(function* () {
  const bundleStart = performance.now();

  yield* bundleWorkerScript();

  return performance.now() - bundleStart;
});

export const measureMcpMiniflareBootstrap = Effect.fn("measureMcpMiniflareBootstrap")(function* () {
  const bundleMs = yield* measureMcpWorkerBundle();
  const script = yield* bundleWorkerScript();
  const readyStart = performance.now();
  const miniflare = createMiniflare(script);

  yield* Effect.tryPromise({
    try: () => miniflare.ready,
    catch: () =>
      new McpMiniflareTransportError({
        message: "Miniflare worker could not be initialized.",
      }),
  });

  const readyMs = performance.now() - readyStart;

  yield* Effect.tryPromise({
    try: () => miniflare.dispose(),
    catch: () =>
      new McpMiniflareTransportError({
        message: "Miniflare worker could not be disposed.",
      }),
  });

  return {
    bundleMs,
    readyMs,
    totalMs: bundleMs + readyMs,
  };
});

export const createMcpMiniflareClient = async (): Promise<McpMiniflareClient> => {
  const script = await Effect.runPromise(bundleWorkerScript().pipe(Effect.provide(Path.layer)));
  const miniflare = createMiniflare(script);
  const baseUrl = new URL("/mcp", await miniflare.ready).toString();
  const responses: Array<Response> = [];

  let sessionId: string | null = null;
  const nextRequestId = () => responses.length + 1;

  const request: McpRequest = <S extends Schema.Top>(
    schema: S,
    method: string,
    params?: unknown,
    options?: {
      readonly id?: number | string;
    },
  ) =>
    Effect.gen(function* () {
      const requestBody = yield* encodeJsonString({
        id: options?.id ?? nextRequestId(),
        jsonrpc: "2.0",
        method,
        params,
      });
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(baseUrl, {
            method: "POST",
            headers: createMcpRequestHeaders(sessionId),
            body: requestBody,
          }),
        catch: () =>
          new McpMiniflareTransportError({
            message: `MCP request failed for method ${method}.`,
          }),
      });

      sessionId = response.headers.get("Mcp-Session-Id") ?? sessionId;
      responses.push(response.clone());

      const json = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () =>
          new McpMiniflareTransportError({
            message: `MCP response body was not valid JSON for method ${method}.`,
          }),
      });
      const errorEnvelope = decodeJsonRpcErrorEnvelope(json);

      if (Option.isSome(errorEnvelope)) {
        return yield* new McpJsonRpcResponseError(errorEnvelope.value.error);
      }

      const successEnvelope = yield* decodeJsonRpcSuccessEnvelope(json);
      return yield* Schema.decodeUnknownEffect(schema)(successEnvelope.result);
    });

  return {
    request,
    responses,
    resetSession: () => {
      sessionId = null;
      responses.length = 0;
    },
    dispose: () => miniflare.dispose(),
  };
};

function createMcpRequestHeaders(sessionId: string | null): Readonly<Record<string, string>> {
  if (sessionId === null) {
    return {
      "content-type": "application/json",
    };
  }

  return {
    "content-type": "application/json",
    "Mcp-Session-Id": sessionId,
  };
}

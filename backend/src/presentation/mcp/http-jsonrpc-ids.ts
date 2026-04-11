import * as Schema from "effect/Schema";

const maxSurrogateRequestId = Number.MAX_SAFE_INTEGER;

const JsonRpcIdSchema = Schema.Union([Schema.String, Schema.Number]);

const JsonRpcRequestEnvelopeSchema = Schema.Struct({
  id: Schema.optionalKey(JsonRpcIdSchema),
  jsonrpc: Schema.Literal("2.0"),
  method: Schema.String,
});

const JsonRpcResponseEnvelopeSchema = Schema.Struct({
  id: Schema.optionalKey(Schema.Union([Schema.String, Schema.Number, Schema.Null])),
  jsonrpc: Schema.Literal("2.0"),
});

const isJsonRpcRequestEnvelope = Schema.is(JsonRpcRequestEnvelopeSchema);
const isJsonRpcResponseEnvelope = Schema.is(JsonRpcResponseEnvelopeSchema);

type JsonRpcBody = readonly unknown[] | Record<string, unknown>;

interface JsonRpcRequestNormalization {
  readonly request: Request;
  readonly surrogateIdMap: ReadonlyMap<number, string>;
}

interface JsonRpcRequestRewrite {
  readonly body: JsonRpcBody;
  readonly surrogateIdMap: ReadonlyMap<number, string>;
}

export async function normalizeMcpHttpRequestIds(
  request: Request,
): Promise<JsonRpcRequestNormalization> {
  if (!isMcpJsonRequest(request)) {
    return {
      request,
      surrogateIdMap: new Map(),
    };
  }

  const body = await readJsonBody(request);
  if (body === null) {
    return {
      request,
      surrogateIdMap: new Map(),
    };
  }

  const rewritten = rewriteJsonRpcRequestIds(body);
  if (rewritten === null) {
    return {
      request,
      surrogateIdMap: new Map(),
    };
  }

  return {
    request: createJsonRequest(request, rewritten.body),
    surrogateIdMap: rewritten.surrogateIdMap,
  };
}

export async function restoreMcpHttpResponseIds(
  response: Response,
  surrogateIdMap: ReadonlyMap<number, string>,
): Promise<Response> {
  if (surrogateIdMap.size === 0) {
    return response;
  }

  const body = await readJsonBody(response);
  if (body === null) {
    return response;
  }

  const rewritten = rewriteJsonRpcResponseIds(body, surrogateIdMap);
  if (rewritten === null) {
    return response;
  }

  return createJsonResponse(response, rewritten);
}

function isMcpJsonRequest(request: Request): boolean {
  const { pathname } = new URL(request.url);
  const contentType = request.headers.get("content-type") ?? "";
  return (
    request.method === "POST" &&
    contentType.includes("application/json") &&
    (pathname === "/mcp" || pathname.startsWith("/mcp/"))
  );
}

async function readJsonBody(message: Request | Response): Promise<JsonRpcBody | null> {
  const body = await message
    .clone()
    .json()
    .catch(() => null);

  return isJsonRpcBody(body) ? body : null;
}

function rewriteJsonRpcRequestIds(body: JsonRpcBody): JsonRpcRequestRewrite | null {
  const surrogateIdMap = new Map<number, string>();
  let nextSurrogateId = maxSurrogateRequestId;
  const nextId = () => nextSurrogateId--;

  if (isJsonRpcArray(body)) {
    const rewrittenBody = body.map((value) =>
      rewriteJsonRpcRequestValue(value, surrogateIdMap, nextId),
    );

    if (surrogateIdMap.size === 0) {
      return null;
    }

    return {
      body: rewrittenBody,
      surrogateIdMap,
    };
  }

  const rewrittenBody = rewriteJsonRpcRequestObject(body, surrogateIdMap, nextId);
  if (surrogateIdMap.size === 0) {
    return null;
  }

  return {
    body: rewrittenBody,
    surrogateIdMap,
  };
}

function rewriteJsonRpcResponseIds(
  body: JsonRpcBody,
  surrogateIdMap: ReadonlyMap<number, string>,
): JsonRpcBody | null {
  let changed = false;

  if (isJsonRpcArray(body)) {
    const rewrittenBody = body.map((value) =>
      rewriteJsonRpcResponseValue(value, surrogateIdMap, () => {
        changed = true;
      }),
    );

    return changed ? rewrittenBody : null;
  }

  const rewrittenBody = rewriteJsonRpcResponseObject(body, surrogateIdMap, () => {
    changed = true;
  });
  return changed ? rewrittenBody : null;
}

function isJsonRpcBody(value: unknown): value is JsonRpcBody {
  return isJsonRpcArray(value) || isJsonObject(value);
}

function isJsonRpcArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function rewriteJsonRpcRequestValue(
  value: unknown,
  surrogateIdMap: Map<number, string>,
  nextSurrogateId: () => number,
): unknown {
  return isJsonObject(value)
    ? rewriteJsonRpcRequestObject(value, surrogateIdMap, nextSurrogateId)
    : value;
}

function rewriteJsonRpcRequestObject(
  value: Record<string, unknown>,
  surrogateIdMap: Map<number, string>,
  nextSurrogateId: () => number,
): Record<string, unknown> {
  if (!isJsonRpcRequestEnvelope(value) || typeof value.id !== "string") {
    return value;
  }

  const surrogateId = nextSurrogateId();
  surrogateIdMap.set(surrogateId, value.id);

  return {
    ...value,
    id: surrogateId,
  };
}

function rewriteJsonRpcResponseValue(
  value: unknown,
  surrogateIdMap: ReadonlyMap<number, string>,
  onRewrite: () => void,
): unknown {
  return isJsonObject(value)
    ? rewriteJsonRpcResponseObject(value, surrogateIdMap, onRewrite)
    : value;
}

function rewriteJsonRpcResponseObject(
  value: Record<string, unknown>,
  surrogateIdMap: ReadonlyMap<number, string>,
  onRewrite: () => void,
): Record<string, unknown> {
  if (!isJsonRpcResponseEnvelope(value) || typeof value.id !== "number") {
    return value;
  }

  const originalId = surrogateIdMap.get(value.id);
  if (originalId === undefined) {
    return value;
  }

  onRewrite();

  return {
    ...value,
    id: originalId,
  };
}

function createJsonRequest(request: Request, body: JsonRpcBody): Request {
  return new Request(request, {
    body: JSON.stringify(body),
    method: "POST",
  });
}

function createJsonResponse(response: Response, body: JsonRpcBody): Response {
  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(JSON.stringify(body), {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

import * as Schema from "effect/Schema";

const maxSurrogateRequestId = Number.MAX_SAFE_INTEGER;
const encodeJsonString = Schema.encodeUnknownSync(Schema.UnknownFromJsonString);

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

type JsonObject = {
  readonly [key: string]: unknown;
};

type JsonRpcRequestEnvelope = JsonObject & Schema.Schema.Type<typeof JsonRpcRequestEnvelopeSchema>;
type JsonRpcRequestBody = JsonRpcRequestEnvelope | ReadonlyArray<JsonRpcRequestEnvelope>;
type JsonRpcResponseEnvelope = JsonObject &
  Schema.Schema.Type<typeof JsonRpcResponseEnvelopeSchema>;
type JsonRpcResponseBody = JsonRpcResponseEnvelope | ReadonlyArray<JsonRpcResponseEnvelope>;

const isJsonRpcRequestEnvelope = Schema.is(JsonRpcRequestEnvelopeSchema);
const isJsonRpcResponseEnvelope = Schema.is(JsonRpcResponseEnvelopeSchema);
const jsonString = (value: unknown): string => encodeJsonString(value);

interface JsonRpcRequestNormalization {
  readonly request: Request;
  readonly surrogateIdMap: ReadonlyMap<number, string>;
}

interface JsonRpcRequestRewrite {
  readonly body: JsonRpcRequestBody;
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

  const body = await readJsonBody(request, isJsonRpcRequestBody);
  if (body === undefined) {
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

  const body = await readJsonBody(response, isJsonRpcResponseBody);
  if (body === undefined) {
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

async function readJsonBody<A>(
  message: Request | Response,
  isBody: (value: unknown) => value is A,
): Promise<A | undefined> {
  const body = await message
    .clone()
    .json()
    .catch(() => null);

  return isBody(body) ? body : undefined;
}

function rewriteJsonRpcRequestIds(body: JsonRpcRequestBody): JsonRpcRequestRewrite | null {
  const surrogateIdMap = new Map<number, string>();
  const nextId = () => maxSurrogateRequestId - surrogateIdMap.size;

  if (isJsonRpcRequestBatch(body)) {
    const rewrittenBody = body.map((value) =>
      rewriteJsonRpcRequestEnvelope(value, surrogateIdMap, nextId),
    );

    if (surrogateIdMap.size === 0) {
      return null;
    }

    return {
      body: rewrittenBody,
      surrogateIdMap,
    };
  }

  const rewrittenBody = rewriteJsonRpcRequestEnvelope(body, surrogateIdMap, nextId);
  if (surrogateIdMap.size === 0) {
    return null;
  }

  return {
    body: rewrittenBody,
    surrogateIdMap,
  };
}

function rewriteJsonRpcResponseIds(
  body: JsonRpcResponseBody,
  surrogateIdMap: ReadonlyMap<number, string>,
): JsonRpcResponseBody | null {
  let changed = false;

  if (isJsonRpcResponseBatch(body)) {
    const rewrittenBody = body.map((value) =>
      rewriteJsonRpcResponseEnvelope(value, surrogateIdMap, () => {
        changed = true;
      }),
    );

    return changed ? rewrittenBody : null;
  }

  const rewrittenBody = rewriteJsonRpcResponseEnvelope(body, surrogateIdMap, () => {
    changed = true;
  });
  return changed ? rewrittenBody : null;
}

function isJsonRpcRequestBatch(
  body: JsonRpcRequestBody,
): body is ReadonlyArray<JsonRpcRequestEnvelope> {
  return Array.isArray(body);
}

function isJsonRpcResponseBatch(
  body: JsonRpcResponseBody,
): body is ReadonlyArray<JsonRpcResponseEnvelope> {
  return Array.isArray(body);
}

function isJsonRpcRequestBody(value: unknown): value is JsonRpcRequestBody {
  return isJsonRpcRequestEnvelope(value) || isJsonRpcBatch(value, isJsonRpcRequestEnvelope);
}

function isJsonRpcResponseBody(value: unknown): value is JsonRpcResponseBody {
  return isJsonRpcResponseEnvelope(value) || isJsonRpcBatch(value, isJsonRpcResponseEnvelope);
}

function isJsonRpcBatch<A>(
  value: unknown,
  isEnvelope: (value: unknown) => value is A,
): value is ReadonlyArray<A> {
  return Array.isArray(value) && value.every(isEnvelope);
}

function rewriteJsonRpcRequestEnvelope(
  value: JsonRpcRequestEnvelope,
  surrogateIdMap: Map<number, string>,
  nextSurrogateId: () => number,
): JsonRpcRequestEnvelope {
  if (typeof value.id !== "string") {
    return value;
  }

  const surrogateId = nextSurrogateId();
  surrogateIdMap.set(surrogateId, value.id);

  return {
    ...value,
    id: surrogateId,
  };
}

function rewriteJsonRpcResponseEnvelope(
  value: JsonRpcResponseEnvelope,
  surrogateIdMap: ReadonlyMap<number, string>,
  onRewrite: () => void,
): JsonRpcResponseEnvelope {
  if (typeof value.id !== "number") {
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

function createJsonRequest(request: Request, body: JsonRpcRequestBody): Request {
  return new Request(request, {
    body: jsonString(body),
    method: "POST",
  });
}

function createJsonResponse(response: Response, body: JsonRpcResponseBody): Response {
  return new Response(jsonString(body), {
    headers: Object.fromEntries(
      Array.from(response.headers).filter(([name]) => name.toLowerCase() !== "content-length"),
    ),
    status: response.status,
    statusText: response.statusText,
  });
}

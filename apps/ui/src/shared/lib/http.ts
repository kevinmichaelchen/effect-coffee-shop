import * as Schema from "effect/Schema";

class HttpRequestError extends Schema.TaggedErrorClass<HttpRequestError>()("HttpRequestError", {
  message: Schema.String,
  status: Schema.Number,
}) {}

class HttpResponseDecodeError extends Schema.TaggedErrorClass<HttpResponseDecodeError>()(
  "HttpResponseDecodeError",
  {
    message: Schema.String,
    status: Schema.Number,
  },
) {}

interface JsonRequestInput<
  SuccessSchema extends Schema.Decoder<unknown>,
  ErrorSchema extends Schema.Decoder<unknown> | undefined = undefined,
> {
  readonly errorMessage?: string;
  readonly errorSchema?: ErrorSchema;
  readonly init?: RequestInit;
  readonly path: string;
  readonly readErrorMessage?: ErrorSchema extends Schema.Decoder<unknown>
    ? (error: ErrorSchema["Type"]) => string
    : undefined;
  readonly schema: SuccessSchema;
}

export async function requestJson<
  SuccessSchema extends Schema.Decoder<unknown>,
  ErrorSchema extends Schema.Decoder<unknown> | undefined = undefined,
>(input: JsonRequestInput<SuccessSchema, ErrorSchema>): Promise<SuccessSchema["Type"]> {
  const response = await fetch(input.path, input.init);

  if (!response.ok) {
    return rejectRequestError(
      response,
      input.errorMessage,
      input.errorSchema,
      input.readErrorMessage,
    );
  }

  const decodedResponse = await readResponseJson(response, input.schema)
    .then((value) => ({ success: true as const, value }))
    .catch(() => ({ success: false as const }));

  if (!decodedResponse.success) {
    return Promise.reject(
      new HttpResponseDecodeError({
        message: `Unexpected response body from ${input.path}.`,
        status: response.status,
      }),
    );
  }

  return decodedResponse.value;
}

async function rejectRequestError(
  response: Response,
  fallbackMessage: string | undefined,
  errorSchema: Schema.Decoder<unknown> | undefined,
  readErrorMessage: ((error: unknown) => string) | undefined,
): Promise<never> {
  const fallback = fallbackMessage ?? `${response.status} ${response.statusText}`;

  if (errorSchema === undefined || readErrorMessage === undefined) {
    return Promise.reject(
      new HttpRequestError({
        message: fallback,
        status: response.status,
      }),
    );
  }

  const rawBody = await response.text();
  const message = await decodeJsonText(rawBody, errorSchema)
    .then(readErrorMessage)
    .catch(() => fallback);

  return Promise.reject(
    new HttpRequestError({
      message,
      status: response.status,
    }),
  );
}

async function readResponseJson<SuccessSchema extends Schema.Decoder<unknown>>(
  response: Response,
  schema: SuccessSchema,
): Promise<SuccessSchema["Type"]> {
  const rawBody = await response.text();
  return decodeJsonText(rawBody, schema);
}

async function decodeJsonText<SchemaType extends Schema.Decoder<unknown>>(
  rawBody: string,
  schema: SchemaType,
): Promise<SchemaType["Type"]> {
  return Schema.decodeUnknownPromise(schema)(
    Schema.decodeUnknownSync(Schema.UnknownFromJsonString)(rawBody),
  );
}

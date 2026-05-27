import * as Effect from "effect/Effect";
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

interface JsonRequestInputBase<SuccessSchema extends Schema.Decoder<unknown>> {
  readonly errorMessage?: string;
  readonly init?: RequestInit;
  readonly path: string;
  readonly schema: SuccessSchema;
}

interface JsonRequestInputWithError<
  SuccessSchema extends Schema.Decoder<unknown>,
  ErrorSchema extends Schema.Decoder<unknown>,
> extends JsonRequestInputBase<SuccessSchema> {
  readonly errorSchema: ErrorSchema;
  readonly readErrorMessage: (error: ErrorSchema["Type"]) => string;
}

interface JsonRequestInputWithoutError<
  SuccessSchema extends Schema.Decoder<unknown>,
> extends JsonRequestInputBase<SuccessSchema> {
  readonly errorSchema?: undefined;
  readonly readErrorMessage?: undefined;
}

type JsonRequestInput<
  SuccessSchema extends Schema.Decoder<unknown>,
  ErrorSchema extends Schema.Decoder<unknown>,
> =
  | JsonRequestInputWithError<SuccessSchema, ErrorSchema>
  | JsonRequestInputWithoutError<SuccessSchema>;

export function requestJson<SuccessSchema extends Schema.Decoder<unknown>>(
  input: JsonRequestInputWithoutError<SuccessSchema>,
): Promise<SuccessSchema["Type"]>;
export function requestJson<
  SuccessSchema extends Schema.Decoder<unknown>,
  ErrorSchema extends Schema.Decoder<unknown>,
>(input: JsonRequestInputWithError<SuccessSchema, ErrorSchema>): Promise<SuccessSchema["Type"]>;
export async function requestJson<
  SuccessSchema extends Schema.Decoder<unknown>,
  ErrorSchema extends Schema.Decoder<unknown>,
>(input: JsonRequestInput<SuccessSchema, ErrorSchema>): Promise<SuccessSchema["Type"]> {
  return Effect.runPromise(requestJsonEffect(input));
}

function requestJsonEffect<
  SuccessSchema extends Schema.Decoder<unknown>,
  ErrorSchema extends Schema.Decoder<unknown>,
>(
  input: JsonRequestInput<SuccessSchema, ErrorSchema>,
): Effect.Effect<SuccessSchema["Type"], HttpRequestError | HttpResponseDecodeError> {
  return fetchResponse(input).pipe(
    Effect.flatMap(
      (
        response,
      ): Effect.Effect<SuccessSchema["Type"], HttpRequestError | HttpResponseDecodeError> =>
        response.ok
          ? readResponseJson(response, input.path, input.schema)
          : rejectRequestError(response, input),
    ),
  );
}

function fetchResponse(input: {
  readonly errorMessage?: string;
  readonly init?: RequestInit;
  readonly path: string;
}): Effect.Effect<Response, HttpRequestError> {
  return Effect.tryPromise({
    try: async () => fetch(input.path, input.init),
    catch: () =>
      new HttpRequestError({
        message: input.errorMessage ?? `Unable to request ${input.path}.`,
        status: 0,
      }),
  });
}

function rejectRequestError<
  SuccessSchema extends Schema.Decoder<unknown>,
  ErrorSchema extends Schema.Decoder<unknown>,
>(
  response: Response,
  input: JsonRequestInput<SuccessSchema, ErrorSchema>,
): Effect.Effect<never, HttpRequestError> {
  const fallbackMessage = input.errorMessage ?? `${response.status} ${response.statusText}`;
  const errorSchema = input.errorSchema;
  const readErrorMessage = input.readErrorMessage;

  if (errorSchema === undefined || readErrorMessage === undefined) {
    return Effect.fail(
      new HttpRequestError({
        message: fallbackMessage,
        status: response.status,
      }),
    );
  }

  return readResponseText(response, input.path).pipe(
    Effect.matchEffect({
      onFailure: () => Effect.succeed(fallbackMessage),
      onSuccess: (rawBody) =>
        decodeJsonText(rawBody, response.status, input.path, errorSchema).pipe(
          Effect.matchEffect({
            onFailure: () => Effect.succeed(fallbackMessage),
            onSuccess: (error) => Effect.succeed(readErrorMessage(error)),
          }),
        ),
    }),
    Effect.flatMap((message) =>
      Effect.fail(
        new HttpRequestError({
          message,
          status: response.status,
        }),
      ),
    ),
  );
}

function readResponseJson<SuccessSchema extends Schema.Decoder<unknown>>(
  response: Response,
  path: string,
  schema: SuccessSchema,
): Effect.Effect<SuccessSchema["Type"], HttpResponseDecodeError> {
  return readResponseText(response, path).pipe(
    Effect.flatMap((rawBody) => decodeJsonText(rawBody, response.status, path, schema)),
  );
}

function readResponseText(
  response: Response,
  path: string,
): Effect.Effect<string, HttpResponseDecodeError> {
  return Effect.tryPromise({
    try: async () => response.text(),
    catch: () =>
      new HttpResponseDecodeError({
        message: `Unable to read response body from ${path}.`,
        status: response.status,
      }),
  });
}

function decodeJsonText<SchemaType extends Schema.Decoder<unknown>>(
  rawBody: string,
  status: number,
  path: string,
  schema: SchemaType,
): Effect.Effect<SchemaType["Type"], HttpResponseDecodeError> {
  return Schema.decodeUnknownEffect(Schema.UnknownFromJsonString)(rawBody).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError(
      () =>
        new HttpResponseDecodeError({
          message: `Unexpected response body from ${path}.`,
          status,
        }),
    ),
  );
}

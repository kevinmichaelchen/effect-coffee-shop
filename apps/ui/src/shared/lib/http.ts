import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import type * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Schema from "effect/Schema";

export class HttpRequestError extends Schema.TaggedError<
  HttpRequestError,
  { readonly brand: unique symbol }
>()("HttpRequestError", {
  message: Schema.String,
  status: Schema.Finite,
}) {}

export class HttpResponseDecodeError extends Schema.TaggedError<
  HttpResponseDecodeError,
  { readonly brand: unique symbol }
>()("HttpResponseDecodeError", {
  message: Schema.String,
  status: Schema.Finite,
}) {}

/** @public Named type used by an exported component or request contract. */
export interface JsonRequestInputBase<SuccessSchema extends Schema.ConstraintDecoder<unknown>> {
  readonly errorMessage?: string;
  readonly path: string;
  readonly schema: SuccessSchema;
}

export interface JsonRequestInputWithError<
  SuccessSchema extends Schema.ConstraintDecoder<unknown>,
  ErrorSchema extends Schema.ConstraintDecoder<unknown>,
> extends JsonRequestInputBase<SuccessSchema> {
  readonly errorSchema: ErrorSchema;
  readonly readErrorMessage: (error: ErrorSchema["Type"]) => string;
}

export interface JsonRequestInputWithoutError<
  SuccessSchema extends Schema.ConstraintDecoder<unknown>,
> extends JsonRequestInputBase<SuccessSchema> {
  readonly errorSchema?: undefined;
  readonly readErrorMessage?: undefined;
}

export type JsonRequestInput<
  SuccessSchema extends Schema.ConstraintDecoder<unknown>,
  ErrorSchema extends Schema.ConstraintDecoder<unknown>,
> =
  | JsonRequestInputWithError<SuccessSchema, ErrorSchema>
  | JsonRequestInputWithoutError<SuccessSchema>;

/** GETs `path` with the app's HttpClient and decodes the JSON body. */
export function requestJson<
  SuccessSchema extends Schema.ConstraintDecoder<unknown>,
  ErrorSchema extends Schema.ConstraintDecoder<unknown>,
>(
  input: JsonRequestInput<SuccessSchema, ErrorSchema>,
): Effect.Effect<
  SuccessSchema["Type"],
  HttpRequestError | HttpResponseDecodeError,
  HttpClient.HttpClient
> {
  return HttpClient.get(input.path).pipe(
    Effect.mapError(
      () =>
        new HttpRequestError({
          message: input.errorMessage ?? `Unable to request ${input.path}.`,
          status: 0,
        }),
    ),
    Effect.flatMap(
      (
        response,
      ): Effect.Effect<SuccessSchema["Type"], HttpRequestError | HttpResponseDecodeError> =>
        response.status >= 200 && response.status < 300
          ? readResponseJson(response, input.path, input.schema)
          : rejectRequestError(response, input),
    ),
  );
}

function rejectRequestError<
  SuccessSchema extends Schema.ConstraintDecoder<unknown>,
  ErrorSchema extends Schema.ConstraintDecoder<unknown>,
>(
  response: HttpClientResponse.HttpClientResponse,
  input: JsonRequestInput<SuccessSchema, ErrorSchema>,
): Effect.Effect<never, HttpRequestError> {
  const fallbackMessage =
    input.errorMessage ?? `Request to ${input.path} failed with status ${response.status}.`;
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
          Effect.match({
            onFailure: () => fallbackMessage,
            onSuccess: readErrorMessage,
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

function readResponseJson<SuccessSchema extends Schema.ConstraintDecoder<unknown>>(
  response: HttpClientResponse.HttpClientResponse,
  path: string,
  schema: SuccessSchema,
): Effect.Effect<SuccessSchema["Type"], HttpResponseDecodeError> {
  return readResponseText(response, path).pipe(
    Effect.flatMap((rawBody) => decodeJsonText(rawBody, response.status, path, schema)),
  );
}

function readResponseText(
  response: HttpClientResponse.HttpClientResponse,
  path: string,
): Effect.Effect<string, HttpResponseDecodeError> {
  return response.text.pipe(
    Effect.mapError(
      () =>
        new HttpResponseDecodeError({
          message: `Unable to read response body from ${path}.`,
          status: response.status,
        }),
    ),
  );
}

function decodeJsonText<SchemaType extends Schema.ConstraintDecoder<unknown>>(
  rawBody: string,
  status: number,
  path: string,
  schema: SchemaType,
): Effect.Effect<SchemaType["Type"], HttpResponseDecodeError> {
  return Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(rawBody).pipe(
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

import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { AssistantModelRequestError, AssistantModelResponseDecodeError } from "./model.ts";

export function decodeJsonTextEffect<SchemaType extends Schema.Decoder<unknown>>(input: {
  readonly provider: string;
  readonly rawBody: string;
  readonly schema: SchemaType;
}): Effect.Effect<SchemaType["Type"], AssistantModelResponseDecodeError> {
  return Schema.decodeUnknownEffect(Schema.UnknownFromJsonString)(input.rawBody).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(input.schema)),
    Effect.mapError(
      () =>
        new AssistantModelResponseDecodeError({
          message: `${input.provider} returned an unexpected response body.`,
          provider: input.provider,
        }),
    ),
  );
}

export function createProviderStatusMessage(input: {
  readonly provider: string;
  readonly rawBody: string;
  readonly status: number;
}): string {
  const trimmedBody = input.rawBody.trim();

  if (trimmedBody === "") {
    return `${input.provider} request failed with ${input.status}.`;
  }

  return `${input.provider} request failed with ${input.status}: ${trimmedBody}`;
}

function postJson(input: {
  readonly body: unknown;
  readonly headers?: HeadersInit;
  readonly provider: string;
  readonly url: string;
}): Effect.Effect<Response, AssistantModelRequestError> {
  const headers = new Headers(input.headers);
  headers.set("content-type", "application/json");

  return Effect.tryPromise({
    try: () =>
      fetch(input.url, {
        body: JSON.stringify(input.body),
        headers,
        method: "POST",
      }),
    catch: () =>
      new AssistantModelRequestError({
        message: `${input.provider} request failed before receiving a response.`,
        provider: input.provider,
      }),
  });
}

export function postJsonResponse<A, E>(input: {
  readonly body: unknown;
  readonly headers?: HeadersInit;
  readonly onResponse: (response: Response) => Effect.Effect<A, E>;
  readonly onStatusError: (response: Response) => Effect.Effect<never, AssistantModelRequestError>;
  readonly provider: string;
  readonly url: string;
}): Effect.Effect<A, AssistantModelRequestError | E> {
  return Effect.gen(function* () {
    const request = Option.match(Option.fromNullishOr(input.headers), {
      onNone: () => ({
        body: input.body,
        provider: input.provider,
        url: input.url,
      }),
      onSome: (headers) => ({
        body: input.body,
        headers,
        provider: input.provider,
        url: input.url,
      }),
    });
    const response = yield* postJson(request);

    if (!response.ok) {
      return yield* input.onStatusError(response);
    }

    return yield* input.onResponse(response);
  });
}

export function readResponseText(input: {
  readonly provider: string;
  readonly response: Response;
}): Effect.Effect<string, AssistantModelRequestError> {
  return Effect.tryPromise({
    try: () => input.response.text(),
    catch: () =>
      new AssistantModelRequestError({
        message: `${input.provider} response body could not be read.`,
        provider: input.provider,
        status: input.response.status,
      }),
  });
}

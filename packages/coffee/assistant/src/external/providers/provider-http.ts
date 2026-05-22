/**
 * Provides shared Effect HTTP helpers for assistant model providers.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import {
  AssistantModelRequestError,
  AssistantModelResponseDecodeError,
} from "../../application/model.ts";

export function decodeJsonTextEffect<SchemaType extends Schema.Decoder<unknown>>(input: {
  readonly provider: string;
  readonly rawBody: string;
  readonly schema: SchemaType;
}) {
  return Schema.decodeUnknownEffect(Schema.UnknownFromJsonString)(input.rawBody).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(input.schema)),
    Effect.catchTag("SchemaError", () =>
      Effect.fail(
        new AssistantModelResponseDecodeError({
          message: `${input.provider} returned an unexpected response body.`,
          provider: input.provider,
        }),
      ),
    ),
  );
}

export function createProviderStatusMessage(input: {
  readonly provider: string;
  readonly rawBody: string;
  readonly status: number;
}): string {
  const trimmedBody = input.rawBody.trim();

  return Option.match(
    Option.liftPredicate(trimmedBody, (body) => body !== ""),
    {
      onNone: () => `${input.provider} request failed with ${input.status}.`,
      onSome: (body) => `${input.provider} request failed with ${input.status}: ${body}`,
    },
  );
}

function postJson(input: {
  readonly bearerToken: Redacted.Redacted<string> | undefined;
  readonly body: unknown;
  readonly provider: string;
  readonly url: string | URL;
}) {
  const request = Option.match(Option.fromUndefinedOr(input.bearerToken), {
    onNone: () => HttpClientRequest.post(input.url),
    onSome: (bearerToken) =>
      HttpClientRequest.post(input.url).pipe(HttpClientRequest.bearerToken(bearerToken)),
  }).pipe(HttpClientRequest.acceptJson);

  return HttpClientRequest.bodyJson(request, input.body).pipe(
    Effect.mapError(
      () =>
        new AssistantModelRequestError({
          message: `${input.provider} request body could not be encoded as JSON.`,
          provider: input.provider,
        }),
    ),
    Effect.flatMap((requestWithBody) =>
      HttpClient.execute(requestWithBody).pipe(
        Effect.provide(FetchHttpClient.layer),
        Effect.mapError(
          () =>
            new AssistantModelRequestError({
              message: `${input.provider} request failed before receiving a response.`,
              provider: input.provider,
            }),
        ),
      ),
    ),
  );
}

export function postJsonResponse<A, E>(input: {
  readonly bearerToken?: Redacted.Redacted<string>;
  readonly body: unknown;
  readonly onResponse: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, E>;
  readonly onStatusError: (
    response: HttpClientResponse.HttpClientResponse,
  ) => Effect.Effect<never, AssistantModelRequestError>;
  readonly provider: string;
  readonly url: string | URL;
}) {
  return Effect.gen(function* () {
    const response = yield* postJson({
      bearerToken: input.bearerToken,
      body: input.body,
      provider: input.provider,
      url: input.url,
    });

    return yield* Match.value(response.status >= 200 && response.status < 300).pipe(
      Match.when(true, () => input.onResponse(response)),
      Match.orElse(() => input.onStatusError(response)),
    );
  });
}

export function readResponseText(input: {
  readonly provider: string;
  readonly response: HttpClientResponse.HttpClientResponse;
}) {
  return input.response.text.pipe(
    Effect.mapError(
      () =>
        new AssistantModelRequestError({
          message: `${input.provider} response body could not be read.`,
          provider: input.provider,
          status: input.response.status,
        }),
    ),
  );
}

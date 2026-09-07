import { it } from "@effect/vitest";
/**
 * Verifies the shared assistant provider HTTP boundary.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import * as RateLimiter from "effect/unstable/persistence/RateLimiter";
import { describe, expect } from "vitest";
import { AssistantModelRequestError } from "../../application/model.ts";
import {
  decodeJsonResponseEffect,
  postJsonResponse,
  type ProviderHttpClient,
} from "./provider-http.ts";

const TestResponse = Schema.Struct({
  value: Schema.String,
});

const testProvider = "Test provider";

const makeClient = (response: Response) =>
  Effect.gen(function* () {
    const limiter = yield* RateLimiter.make;

    return HttpClient.make((request) =>
      Effect.succeed(HttpClientResponse.fromWeb(request, response)),
    ).pipe(
      HttpClient.withRateLimiter({
        key: (request) => request.url,
        limit: 50,
        limiter,
        times: 0,
        window: "1 second",
      }),
    );
  }).pipe(Effect.provide(RateLimiter.layerStoreMemory));

const runRequest = (client: ProviderHttpClient) =>
  postJsonResponse({
    body: { request: true },
    client,
    onResponse: (httpResponse) =>
      decodeJsonResponseEffect({
        provider: testProvider,
        response: httpResponse,
        schema: TestResponse,
      }),
    onStatusError: (httpResponse) =>
      Effect.fail(
        new AssistantModelRequestError({
          message: `status ${httpResponse.status}`,
          provider: testProvider,
          status: httpResponse.status,
        }),
      ),
    provider: testProvider,
    url: "https://example.test/provider",
  });

describe("provider HTTP", () => {
  it.effect("encodes JSON requests and decodes schema-validated JSON responses", () =>
    Effect.gen(function* () {
      const client = yield* makeClient(
        new Response('{"value":"decoded"}', {
          headers: { "content-type": "application/json" },
        }),
      );
      const result = yield* runRequest(client);

      expect(result).toEqual({ value: "decoded" });
    }),
  );

  it.effect("maps malformed JSON and schema-invalid responses to a response decode error", () =>
    Effect.gen(function* () {
      const malformedClient = yield* makeClient(new Response("not JSON"));
      const malformed = yield* runRequest(malformedClient).pipe(Effect.flip);
      const schemaInvalidClient = yield* makeClient(new Response('{"value":1}'));
      const schemaInvalid = yield* runRequest(schemaInvalidClient).pipe(Effect.flip);

      expect(malformed._tag).toBe("AssistantModelResponseDecodeError");
      expect(schemaInvalid._tag).toBe("AssistantModelResponseDecodeError");
    }),
  );

  it.effect("uses HTTP status filtering before attempting a success decode", () =>
    Effect.gen(function* () {
      const client = yield* makeClient(new Response("not JSON", { status: 429 }));
      const error = yield* runRequest(client).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "AssistantModelRequestError",
        status: 429,
      });
    }),
  );

  it.effect("classifies response body I/O failures as response decode errors", () =>
    Effect.gen(function* () {
      const stream = new ReadableStream({
        start(controller) {
          controller.error("body unavailable");
        },
      });
      const client = yield* makeClient(new Response(stream, { status: 200 }));
      const error = yield* runRequest(client).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "AssistantModelResponseDecodeError",
      });
    }),
  );
});

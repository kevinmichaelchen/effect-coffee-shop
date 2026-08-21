/**
 * Verifies the shared assistant provider HTTP boundary.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import * as RateLimiter from "effect/unstable/persistence/RateLimiter";
import { describe, expect, it } from "vitest";
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
  it("encodes JSON requests and decodes schema-validated JSON responses", async () => {
    const client = await Effect.runPromise(
      makeClient(
        new Response('{"value":"decoded"}', {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const result = await Effect.runPromise(runRequest(client));

    expect(result).toEqual({ value: "decoded" });
  });

  it("maps malformed JSON and schema-invalid responses to a response decode error", async () => {
    const malformedClient = await Effect.runPromise(makeClient(new Response("not JSON")));
    const malformed = await Effect.runPromise(runRequest(malformedClient).pipe(Effect.flip));
    const schemaInvalidClient = await Effect.runPromise(makeClient(new Response('{"value":1}')));
    const schemaInvalid = await Effect.runPromise(
      runRequest(schemaInvalidClient).pipe(Effect.flip),
    );

    expect(malformed._tag).toBe("AssistantModelResponseDecodeError");
    expect(schemaInvalid._tag).toBe("AssistantModelResponseDecodeError");
  });

  it("uses HTTP status filtering before attempting a success decode", async () => {
    const client = await Effect.runPromise(makeClient(new Response("not JSON", { status: 429 })));
    const error = await Effect.runPromise(runRequest(client).pipe(Effect.flip));

    expect(error).toMatchObject({
      _tag: "AssistantModelRequestError",
      status: 429,
    });
  });

  it("classifies response body I/O failures as response decode errors", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.error("body unavailable");
      },
    });
    const client = await Effect.runPromise(makeClient(new Response(stream, { status: 200 })));
    const error = await Effect.runPromise(runRequest(client).pipe(Effect.flip));

    expect(error).toMatchObject({
      _tag: "AssistantModelResponseDecodeError",
    });
  });
});

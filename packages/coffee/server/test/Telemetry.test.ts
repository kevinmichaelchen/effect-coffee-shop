import { describe, expect, it } from "@effect/vitest";
import { TelemetryRelay } from "../src/CoffeeServer.ts";
import { TelemetryRelayLive } from "../src/hosts/edge/TelemetryRelay.ts";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as HttpClient from "effect/http/HttpClient";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerRequestModule from "effect/http/HttpServerRequest";

/** Where the Worker's own telemetry would go, as the runtime's config names it. */
const otlp = "https://otlp.test/v1/traces";

/** A ConfigProvider carrying only the traces endpoint, as the bound config would. */
const configured = ConfigProvider.make((path) =>
  Effect.succeed(
    path.join(".") === "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"
      ? ConfigProvider.makeValue(otlp)
      : undefined,
  ),
);

/** The OTLP body a browser posts, kept opaque by the relay. */
const batch = '{"resourceSpans":[]}';

type Forwarded = { readonly url: string; readonly text: string };

const bodyBytes = Schema.decodeUnknownOption(Schema.Struct({ body: Schema.Uint8Array }));
const decoder = new TextDecoder();

/** An HttpClient that records each forwarded request instead of reaching the network. */
const recording = (seen: Ref.Ref<ReadonlyArray<Forwarded>>) =>
  HttpClient.make((request: HttpClientRequest.HttpClientRequest) =>
    Effect.gen(function* () {
      const bytes = Option.getOrElse(bodyBytes(request.body), () => ({ body: new Uint8Array() }));
      yield* Ref.update(seen, (all) => [
        ...all,
        { url: request.url, text: decoder.decode(bytes.body) },
      ]);
      return HttpClientResponse.fromWeb(request, new Response("{}", { status: 200 }));
    }),
  );

/** The request a browser's OTLP exporter posts: a JSON body at one signal's path. */
const post = (signal: string) =>
  HttpServerRequestModule.fromWeb(
    new Request(`http://coffee.test/api/telemetry/v1/${signal}`, {
      method: "POST",
      body: batch,
      headers: { "content-type": "application/json" },
    }),
  );

describe("the browser's telemetry relay", () => {
  it.effect("forwards a signed-in browser's traces to the Worker's own destination", () => {
    const seen = Ref.makeUnsafe<ReadonlyArray<Forwarded>>([]);
    return Effect.gen(function* () {
      const relay = yield* TelemetryRelay;
      const response = yield* relay
        .receive(Effect.succeed(true))
        .pipe(Effect.provideService(HttpServerRequest, post("traces")));

      expect(response.status).toBe(200);
      expect(yield* Ref.get(seen)).toEqual([{ url: otlp, text: batch }]);
    }).pipe(
      Effect.provide(TelemetryRelayLive),
      Effect.provideService(HttpClient.HttpClient, recording(seen)),
      Effect.provideService(ConfigProvider.ConfigProvider, configured),
    );
  });

  it.effect("refuses a batch the Worker's session check does not admit", () => {
    const seen = Ref.makeUnsafe<ReadonlyArray<Forwarded>>([]);
    return Effect.gen(function* () {
      const relay = yield* TelemetryRelay;
      const response = yield* relay
        .receive(Effect.succeed(false))
        .pipe(Effect.provideService(HttpServerRequest, post("traces")));

      expect(response.status).toBe(403);
      expect(yield* Ref.get(seen)).toEqual([]);
    }).pipe(
      Effect.provide(TelemetryRelayLive),
      Effect.provideService(HttpClient.HttpClient, recording(seen)),
      Effect.provideService(ConfigProvider.ConfigProvider, configured),
    );
  });

  it.effect("accepts only traces: the app exports no logs or metrics", () =>
    Effect.gen(function* () {
      const relay = yield* TelemetryRelay;
      const responses = yield* Effect.forEach(
        ["logs", "metrics"],
        (signal) =>
          relay
            .receive(Effect.succeed(true))
            .pipe(Effect.provideService(HttpServerRequest, post(signal))),
        { concurrency: 1 },
      );

      expect(responses.map((response) => response.status)).toEqual([404, 404]);
    }).pipe(
      Effect.provide(TelemetryRelayLive),
      Effect.provideService(
        HttpClient.HttpClient,
        recording(Ref.makeUnsafe<ReadonlyArray<Forwarded>>([])),
      ),
      Effect.provideService(ConfigProvider.ConfigProvider, configured),
    ),
  );
});

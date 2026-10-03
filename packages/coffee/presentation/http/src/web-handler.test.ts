import { assert, it } from "@effect/vitest";
import { vi } from "vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { CoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import { createHttpRouter } from "@effect-coffee-shop/http-routing/router";
import { routeResponse } from "@effect-coffee-shop/http-routing/route";
import { runHttpEffect } from "@effect-coffee-shop/http-routing/observability";
import { CoffeeHttpApiLive } from "./api.ts";
import { createCoffeeWebHandler } from "./web-handler.ts";

const ConsoleEvent = Schema.fromJsonString(
  Schema.Struct({
    message: Schema.Tuple([Schema.Literal("wide-event")]),
    event: Schema.Literal("http_routing.request"),
    service: Schema.Literal("http-routing"),
    route_kind: Schema.Literal("api"),
    method: Schema.Literal("GET"),
    http_status: Schema.Literal(200),
    status: Schema.Literal("ok"),
    requestId: Schema.String,
  }),
);

it.live("writes exactly one flat JSON event through the composed Fetch boundary", () =>
  Effect.acquireUseRelease(
    Effect.sync(() => vi.spyOn(console, "log").mockImplementation(() => {})),
    (consoleLog) =>
      Effect.acquireUseRelease(
        Effect.sync(() => createCoffeeWebHandler(CoffeeHttpApiLive, CoffeeAppLive)),
        (backend) =>
          Effect.gen(function* () {
            const route = createHttpRouter([
              {
                name: "api",
                matches: () => true,
                handle: ({ request }) =>
                  Effect.promise(() => backend.handler(request)).pipe(Effect.map(routeResponse)),
              },
            ]);
            const response = yield* Effect.promise(() =>
              runHttpEffect(
                route(new Request("https://coffee.example/health?token=secret"), undefined),
              ),
            );
            assert.strictEqual(response.status, 200);
            const body = yield* Effect.promise(() => response.text());
            assert.strictEqual(body, '{"status":"ok"}');
            const events = yield* Schema.decodeUnknownEffect(
              Schema.Tuple([Schema.Tuple([ConsoleEvent])]),
            )(consoleLog.mock.calls);
            assert.match(events[0][0].requestId, /^[0-9a-f-]{36}$/);
          }),
        (backend) => Effect.promise(() => backend.dispose()),
      ),
    (consoleLog) => Effect.sync(() => consoleLog.mockRestore()),
  ),
);

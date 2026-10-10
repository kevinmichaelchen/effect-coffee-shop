import { CoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import { afterEach, assert, expect, it, vi } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as WebHandler from "@effect-coffee-shop/coffee-http/web-handler";
import { startCoffeeBunServer } from "./coffee-bun-server.ts";

const ConsoleEvent = Schema.fromJsonString(
  Schema.Struct({
    event: Schema.Literal("http_routing.request"),
    status: Schema.Literals(["ok", "error"]),
    requestId: Schema.String,
    errorType: Schema.optional(Schema.String),
  }),
);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  { path: "/failure", status: 500, eventStatus: "error", errorType: "Failure", body: "" },
  { path: "/defect", status: 500, eventStatus: "error", errorType: "Defect", body: "" },
  { path: "/health", status: 201, eventStatus: "ok", errorType: undefined, body: "coffee" },
])("the registered Bun fetch resolves $path safely with one correlated event", async (example) => {
  const serve = vi.fn<
    (options: { readonly fetch: (request: Request) => Promise<Response> }) => {
      readonly stop: () => void;
      readonly url: URL;
    }
  >(() => ({
    stop: () => {},
    url: new URL("http://localhost:3000"),
  }));
  vi.stubGlobal("Bun", { env: {}, serve });
  vi.spyOn(process, "on").mockReturnValue(process);
  vi.spyOn(WebHandler, "createCoffeeWebHandler").mockReturnValue({
    dispose: async () => {},
    handler: async () => new Response("coffee", { status: 201, headers: { "x-coffee": "latte" } }),
  });
  const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  await startCoffeeBunServer({
    appLayer: CoffeeAppLive,
    routes: Layer.empty,
    extraRoutes: [
      {
        name: "typed-failure",
        matches: (request) => new URL(request.url).pathname === "/failure",
        handle: () => Effect.fail({ message: "private-password" }),
      },
      {
        name: "promise-defect",
        matches: (request) => new URL(request.url).pathname === "/defect",
        handle: () => Effect.promise(() => Promise.reject({ message: "private-password" })),
      },
    ],
  });
  const options = serve.mock.calls[0]?.[0];
  assert.isDefined(options);
  consoleLog.mockClear();
  const response = await options.fetch(new Request(`https://coffee.example${example.path}`));
  expect(response.status).toBe(example.status);
  expect(await response.text()).toBe(example.body);
  const calls = Schema.decodeUnknownSync(Schema.Tuple([Schema.Tuple([Schema.String])]))(
    consoleLog.mock.calls,
  );
  const event = Schema.decodeSync(ConsoleEvent)(calls[0][0]);
  expect(event.status).toBe(example.eventStatus);
  expect(event.errorType).toBe(example.errorType);
  expect(response.headers.get("x-request-id")).toBe(event.requestId);
  expect(calls[0][0]).not.toContain("private-password");
  expect(consoleError).not.toHaveBeenCalled();
});

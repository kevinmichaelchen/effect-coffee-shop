import { it } from "@effect/vitest";
import { expect } from "vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as TestClock from "effect/testing/TestClock";
import { discardRejectedBody } from "./body.ts";

it.effect("finishes a small rejected body", () =>
  Effect.gen(function* () {
    const request = new Request("http://cache/", { method: "PUT", body: "rejected" });
    if (request.body === null) return yield* Effect.die("Expected a body");
    yield* discardRejectedBody(request.body);
    expect(request.bodyUsed).toBe(true);
  }),
);

it.effect("cancels rejected bodies exceeding the drain budget", () =>
  Effect.gen(function* () {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull: (controller) => controller.enqueue(new Uint8Array(65 * 1024)),
      cancel: () => {
        cancelled = true;
      },
    });
    yield* discardRejectedBody(body);
    expect(cancelled).toBe(true);
  }),
);

it.effect("bounds the wait for a stalled rejected body", () =>
  Effect.gen(function* () {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel: () => {
        cancelled = true;
      },
    });
    const fiber = yield* discardRejectedBody(body).pipe(Effect.forkChild);
    yield* TestClock.adjust("100 millis");
    yield* Fiber.join(fiber);
    expect(cancelled).toBe(true);
  }),
);

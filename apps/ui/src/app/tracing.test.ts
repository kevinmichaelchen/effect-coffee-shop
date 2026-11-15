import { Context, Effect, Layer, Option } from "effect";
import { Flusher } from "effect/observability/OtlpExporter";
import { expect, test } from "vitest";
import { Tracing } from "#app/tracing.ts";

test("the app exports no spans unless a relay URL is configured", async () => {
  const context = await Effect.runPromise(Effect.scoped(Layer.build(Tracing)));

  // With no relay configured there is no exporter, so Effect's default no-op
  // tracer stays in place: nothing is recorded and nothing hits the wire.
  expect(Option.isNone(Context.getOption(context, Flusher))).toBe(true);
});

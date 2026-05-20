import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Formatter from "effect/Formatter";
import * as Path from "effect/Path";
import { measureMcpMiniflareBootstrap, measureMcpWorkerBundle } from "../test/support/McpMiniflare";

const defaultIterations = 7;

const round = (value: number): number => Math.round(value * 100) / 100;

const summarize = (values: ReadonlyArray<number>) => {
  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    averageMs: round(total / values.length),
    maxMs: round(Math.max(...values)),
    minMs: round(Math.min(...values)),
    samplesMs: values.map(round),
  };
};

const parseIterations = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultIterations;
  }

  return parsed;
};

const program = Effect.gen(function* () {
  const iterations = parseIterations(process.argv[2]);
  const bundleSamples = yield* Effect.forEach(
    Array.from({ length: iterations }, () => undefined),
    () => measureMcpWorkerBundle(),
    { concurrency: 1 },
  );
  const fullBootstrap = yield* measureMcpMiniflareBootstrap();

  return {
    bundle: summarize(bundleSamples),
    fullBootstrap,
    iterations,
  };
});

await Effect.runPromise(
  program.pipe(
    Effect.flatMap((report) => Console.log(Formatter.formatJson(report, { space: 2 }))),
    Effect.provide(Path.layer),
  ),
);

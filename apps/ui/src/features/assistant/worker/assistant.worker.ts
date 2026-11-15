import { BrowserWorkerRunner } from "@effect/platform-browser";
import type { ProgressInfo } from "@huggingface/transformers";
import { Cause, Effect, Option, Ref, Schema, Semaphore } from "effect";
import { WorkerRunnerPlatform } from "effect/workers/WorkerRunner";
import { type LocalModel, WorkerEvent, WorkerRequest } from "#features/assistant/lib/protocol.ts";
import { configureOnnxRuntime } from "#features/assistant/worker/ort-env.ts";
import { aggregateProgress } from "#features/assistant/worker/progress.ts";
import {
  generate,
  loadTextModel,
  type TextModelError,
} from "#features/assistant/worker/text-model.ts";
import {
  loadVoiceModel,
  transcribe,
  type VoiceModelError,
} from "#features/assistant/worker/voice-model.ts";

type LoadError = TextModelError | VoiceModelError;

/**
 * The on-device models live here, off the UI thread. Every message in either
 * direction is checked against the protocol Schemas.
 */
const encodeEvent = Schema.encodeSync(WorkerEvent);

const messageOf = (error: { readonly message: string }) => error.message;

/** Loads at most once at a time and keeps only a success, so "Try again" really retries. */
const loadOnce = <A, E>(load: Effect.Effect<A, E>) =>
  Effect.all([Ref.make(Option.none<A>()), Semaphore.make(1)], { concurrency: 1 }).pipe(
    Effect.map(([loaded, lock]) =>
      lock.withPermit(
        Ref.get(loaded).pipe(
          Effect.flatMap(
            Option.match({
              onSome: Effect.succeed,
              onNone: () => load.pipe(Effect.tap((value) => Ref.set(loaded, Option.some(value)))),
            }),
          ),
        ),
      ),
    ),
  );

const program = Effect.gen(function* () {
  // Models load lazily on the first request, so this runs before any session exists.
  yield* configureOnnxRuntime;
  // @effect-diagnostics-next-line unstableApiUsage:off -- BrowserWorkerRunner is Effect's supported worker-side transport; nothing stable wraps a Web Worker.
  const runner = yield* WorkerRunnerPlatform;
  const backing = yield* runner.start<WorkerEvent>();
  // A dedicated worker has exactly one client port, and the browser runner numbers it 0.
  const postEvent = (event: WorkerEvent) => backing.sendUnsafe(0, encodeEvent(event));
  const post = (event: WorkerEvent) => Effect.sync(() => postEvent(event));
  const progressOf = (model: LocalModel) => (loaded: number, total: number) =>
    postEvent(WorkerEvent.cases.Progressed.make({ model, loaded, total }));

  const textProgress = aggregateProgress(progressOf("text"));
  const onTextProgress = (info: ProgressInfo) => {
    if (info.status === "progress") textProgress(info.file, info.loaded, info.total);
  };

  const text = yield* loadOnce(loadTextModel(onTextProgress));
  const voice = yield* loadOnce(loadVoiceModel(progressOf("voice")));
  // One sequence at a time per model: generation state is not shareable.
  const textLock = yield* Semaphore.make(1);
  const voiceLock = yield* Semaphore.make(1);

  const loading = (model: LocalModel): Effect.Effect<void, LoadError> =>
    model === "text" ? Effect.asVoid(text) : Effect.asVoid(voice);

  const handle = (request: WorkerRequest) =>
    WorkerRequest.match(request, {
      Load: ({ model }) =>
        loading(model).pipe(
          Effect.matchEffect({
            onFailure: (error) =>
              post(WorkerEvent.cases.FailedLoad.make({ model, message: messageOf(error) })),
            onSuccess: () => post(WorkerEvent.cases.Loaded.make({ model })),
          }),
        ),
      Generate: (generateRequest) =>
        text.pipe(
          Effect.flatMap((pipeline) => generate(pipeline, generateRequest)),
          (generating) => textLock.withPermit(generating),
          Effect.matchEffect({
            onFailure: (error) =>
              post(
                WorkerEvent.cases.Failed.make({
                  id: generateRequest.id,
                  message: messageOf(error),
                }),
              ),
            onSuccess: (reply) =>
              Effect.log("LFM3 reply", reply).pipe(
                Effect.andThen(
                  post(WorkerEvent.cases.Generated.make({ id: generateRequest.id, text: reply })),
                ),
              ),
          }),
        ),
      Transcribe: ({ id, samples }) =>
        voice.pipe(
          Effect.flatMap((transcriber) => transcribe(transcriber, samples)),
          (transcribing) => voiceLock.withPermit(transcribing),
          Effect.matchEffect({
            onFailure: (error) =>
              post(WorkerEvent.cases.Failed.make({ id, message: messageOf(error) })),
            onSuccess: (heard) => post(WorkerEvent.cases.Transcribed.make({ id, text: heard })),
          }),
        ),
    });

  // The runner forks one fiber per request, so a slow answer never blocks the next message.
  yield* backing.run((_port: number, data: unknown) =>
    Effect.matchEffect(Schema.decodeUnknownEffect(WorkerRequest)(data), {
      onFailure: () => Effect.void,
      onSuccess: (request) =>
        // A defect has no request-shaped answer, so it fails everything still waiting.
        handle(request).pipe(
          Effect.catchCause((cause) =>
            Cause.hasInterruptsOnly(cause)
              ? Effect.void
              : post(WorkerEvent.cases.Crashed.make({ message: Cause.pretty(cause) })),
          ),
        ),
    }),
  );
});

// @effect-diagnostics-next-line unstableApiUsage:off -- the runner side of the worker transport above.
Effect.runFork(program.pipe(Effect.provide(BrowserWorkerRunner.layer)));

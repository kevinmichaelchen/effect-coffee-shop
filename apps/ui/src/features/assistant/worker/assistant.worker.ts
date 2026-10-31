/// <reference lib="webworker" />
import type { ProgressInfo } from "@huggingface/transformers";
import { Cause, Effect, Option, Queue, Ref, Schema, Semaphore, Stream } from "effect";
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
declare const self: DedicatedWorkerGlobalScope;

const encodeEvent = Schema.encodeSync(WorkerEvent);
/** Worker-to-page messages; a dedicated worker's postMessage has no target origin. */
const postEvent = (event: WorkerEvent) =>
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- DedicatedWorkerGlobalScope.postMessage takes no targetOrigin; the rule assumes window.postMessage.
  self.postMessage(encodeEvent(event));
const post = (event: WorkerEvent) => Effect.sync(() => postEvent(event));

const progressOf = (model: LocalModel) => (loaded: number, total: number) =>
  postEvent(WorkerEvent.cases.Progressed.make({ model, loaded, total }));

const textProgress = aggregateProgress(progressOf("text"));
const onTextProgress = (info: ProgressInfo) => {
  if (info.status === "progress") textProgress(info.file, info.loaded, info.total);
};

const messageOf = (error: { readonly message: string }) => error.message;

/** Loads at most once at a time and keeps only a success, so "Try again" really retries. */
const loadOnce = <A, E>(load: Effect.Effect<A, E>) =>
  Effect.all([Ref.make(Option.none<A>()), Semaphore.make(1)]).pipe(
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

  const requests = Stream.callback<unknown>((queue) =>
    Effect.sync(() => {
      self.addEventListener("message", (event: MessageEvent<unknown>) => {
        Queue.offerUnsafe(queue, event.data);
      });
    }),
  );

  yield* requests.pipe(
    Stream.mapEffect((data) => Schema.decodeUnknownEffect(WorkerRequest)(data).pipe(Effect.option)),
    Stream.runForEach(
      Option.match({
        onNone: () => Effect.void,
        onSome: (request) =>
          Effect.forkDetach(
            // A defect has no request-shaped answer, so it fails everything still waiting.
            handle(request).pipe(
              Effect.catchCause((cause) =>
                post(WorkerEvent.cases.Crashed.make({ message: Cause.pretty(cause) })),
              ),
            ),
          ),
      }),
    ),
  );
});

Effect.runFork(program);

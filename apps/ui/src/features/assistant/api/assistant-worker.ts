import { Data, Effect, Option, PubSub, Schema, Stream } from "effect";
import { ManagedResource } from "foldkit";
import type { ChatMessage } from "#features/assistant/lib/prompt.ts";
import { type LocalModel, WorkerEvent, WorkerRequest } from "#features/assistant/lib/protocol.ts";
import type { ToolDefinition } from "#features/assistant/lib/tools.ts";

export class AssistantError extends Data.TaggedError("AssistantError")<{
  readonly message: string;
}> {}

/** The running worker: send a request, or listen to everything it says. */
export interface AssistantWorkerHandle {
  readonly send: (
    request: WorkerRequest,
    transfer?: readonly Transferable[],
  ) => Effect.Effect<void>;
  readonly events: PubSub.PubSub<WorkerEvent>;
}

/** Lives while the assistant is switched on; the Model decides when. */
export const AssistantWorker = ManagedResource.tag<AssistantWorkerHandle>()("AssistantWorker");

const encodeRequest = Schema.encodeSync(WorkerRequest);
const decodeEvent = Schema.decodeUnknownOption(WorkerEvent);

/** Starts the worker for the resource's lifetime; it is terminated when the scope closes. */
export const acquireAssistantWorker = Effect.gen(function* () {
  const events = yield* PubSub.unbounded<WorkerEvent>();
  const worker = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new Worker(new URL("../worker/assistant.worker.ts", import.meta.url), {
          type: "module",
          name: "assistant",
        }),
    ),
    (running) => Effect.sync(() => running.terminate()),
  );
  worker.onmessage = (message: MessageEvent<unknown>) =>
    Option.map(decodeEvent(message.data), (event) => PubSub.publishUnsafe(events, event));
  worker.onerror = (error: ErrorEvent) =>
    PubSub.publishUnsafe(
      events,
      WorkerEvent.cases.FailedLoad.make({ model: "text", message: error.message }),
    );
  const handle: AssistantWorkerHandle = {
    send: (request, transfer = []) =>
      Effect.sync(() => worker.postMessage(encodeRequest(request), [...transfer])),
    events,
  };
  return handle;
});

/** Sends a request and waits for the first event `pick` recognizes as its answer. */
const ask = <A>(
  request: (id: string) => WorkerRequest,
  pick: (event: WorkerEvent, id: string) => Option.Option<Effect.Effect<A, AssistantError>>,
  transfer: readonly Transferable[] = [],
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const worker = yield* AssistantWorker.get;
      const id = yield* Effect.sync(() => crypto.randomUUID());
      // Subscribe before sending so a fast answer cannot slip past.
      const subscription = yield* PubSub.subscribe(worker.events);
      yield* worker.send(request(id), transfer);
      const answer: Effect.Effect<A, AssistantError> = PubSub.take(subscription).pipe(
        Effect.flatMap((event) =>
          Option.getOrElse(pick(event, id), () => Effect.suspend(() => answer)),
        ),
      );
      return yield* answer;
    }),
  ).pipe(
    Effect.catchTag("ResourceNotAvailable", () =>
      Effect.fail(new AssistantError({ message: "Turn on local AI first." })),
    ),
  );

export const loadModel = (model: LocalModel) =>
  ask(
    () => WorkerRequest.cases.Load.make({ model }),
    (event) =>
      event._tag === "Loaded" && event.model === model
        ? Option.some(Effect.void)
        : event._tag === "FailedLoad" && event.model === model
          ? Option.some(Effect.fail(new AssistantError({ message: event.message })))
          : Option.none(),
  );

const answerFor =
  (tag: "Generated" | "Transcribed") =>
  (event: WorkerEvent, id: string): Option.Option<Effect.Effect<string, AssistantError>> =>
    event._tag === tag && event.id === id
      ? Option.some(Effect.succeed(event.text))
      : event._tag === "Failed" && event.id === id
        ? Option.some(Effect.fail(new AssistantError({ message: event.message })))
        : Option.none();

export const generateReply = (messages: readonly ChatMessage[], tools: readonly ToolDefinition[]) =>
  ask((id) => WorkerRequest.cases.Generate.make({ id, messages, tools }), answerFor("Generated"));

export const transcribeSamples = (samples: Float32Array) =>
  ask((id) => WorkerRequest.cases.Transcribe.make({ id, samples }), answerFor("Transcribed"), [
    samples.buffer,
  ]);

/** Download progress for either model, for the loading bar. */
export const progressEvents = Stream.unwrap(
  AssistantWorker.get.pipe(Effect.map((worker) => Stream.fromPubSub(worker.events))),
).pipe(
  Stream.filter((event) => event._tag === "Progressed"),
  Stream.catchTag("ResourceNotAvailable", () => Stream.empty),
);

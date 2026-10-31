import { Effect, Option, PubSub, Ref, Schema, Stream } from "effect";
import { ManagedResource } from "foldkit";
import type { ChatMessage } from "#features/assistant/lib/prompt.ts";
import { type LocalModel, WorkerEvent, WorkerRequest } from "#features/assistant/lib/protocol.ts";
import type { ToolDefinition } from "#features/assistant/lib/tools.ts";

class AssistantError extends Schema.TaggedError<
  AssistantError,
  { readonly brand: unique symbol }
>()("AssistantError", { message: Schema.String }) {}

/** The running worker: send a request, or listen to everything it says. */
interface AssistantWorkerHandle {
  readonly send: (
    request: WorkerRequest,
    transfer?: readonly Transferable[],
  ) => Effect.Effect<void>;
  readonly events: PubSub.PubSub<WorkerEvent>;
  /** Latched on the first crash, so a request that subscribes afterwards still fails. */
  readonly crashed: Ref.Ref<Option.Option<string>>;
  /** Correlates a request with its answer; unique for this worker's lifetime. */
  readonly nextId: Effect.Effect<string>;
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
  const crashed = yield* Ref.make(Option.none<string>());
  const requestCount = yield* Ref.make(0);
  const context = yield* Effect.context();
  const publish = (event: WorkerEvent) => {
    if (event._tag === "Crashed")
      Effect.runSyncWith(context)(Ref.set(crashed, Option.some(event.message)));
    PubSub.publishUnsafe(events, event);
  };
  worker.addEventListener("message", (message: MessageEvent<unknown>) =>
    Option.map(decodeEvent(message.data), publish),
  );
  worker.addEventListener("error", (error: ErrorEvent) =>
    publish(
      WorkerEvent.cases.Crashed.make({ message: error.message || "The local AI worker stopped." }),
    ),
  );
  const handle: AssistantWorkerHandle = {
    send: (request, transfer = []) =>
      Effect.sync(() => worker.postMessage(encodeRequest(request), [...transfer])),
    events,
    crashed,
    nextId: Ref.getAndUpdate(requestCount, (count) => count + 1).pipe(Effect.map(String)),
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
      const id = yield* worker.nextId;
      // Subscribe before sending so a fast answer cannot slip past.
      const subscription = yield* PubSub.subscribe(worker.events);
      const crash = yield* Ref.get(worker.crashed);
      if (Option.isSome(crash)) return yield* new AssistantError({ message: crash.value });
      yield* worker.send(request(id), transfer);
      const answer: Effect.Effect<A, AssistantError> = PubSub.take(subscription).pipe(
        Effect.flatMap((event) =>
          event._tag === "Crashed"
            ? Effect.fail(new AssistantError({ message: event.message }))
            : Option.getOrElse(pick(event, id), () => Effect.suspend(() => answer)),
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

/** What the UI hears without asking: download progress, and the worker breaking. */
type WorkerNotice = Extract<WorkerEvent, { readonly _tag: "Progressed" | "Crashed" }>;

const toNotice = (event: WorkerEvent): Option.Option<WorkerNotice> =>
  event._tag === "Progressed" || event._tag === "Crashed" ? Option.some(event) : Option.none();

export const workerNotices = Stream.unwrap(
  AssistantWorker.get.pipe(Effect.map((worker) => Stream.fromPubSub(worker.events))),
).pipe(
  Stream.flatMap((event) =>
    Option.match(toNotice(event), { onNone: () => Stream.empty, onSome: Stream.make }),
  ),
  Stream.catchTag("ResourceNotAvailable", () => Stream.empty),
);

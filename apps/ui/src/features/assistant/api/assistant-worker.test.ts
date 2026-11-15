import { Effect, Option, PubSub, Ref } from "effect";
import type { ManagedResource } from "foldkit";
import { describe, expect, test } from "vitest";
import { AssistantWorker, generateReply } from "#features/assistant/api/assistant-worker.ts";
import type { WorkerEvent, WorkerRequest } from "#features/assistant/lib/protocol.ts";

type Services = ManagedResource.ServiceOf<typeof AssistantWorker>;

/**
 * Stands in for the worker thread: answers each request with the events the test
 * scripted, and latches a crash the way the real subscription does.
 */
const withWorker = <A, E>(
  answer: (request: WorkerRequest) => ReadonlyArray<WorkerEvent>,
  body: (sent: Ref.Ref<ReadonlyArray<WorkerRequest>>) => Effect.Effect<A, E, Services>,
) =>
  Effect.gen(function* () {
    const events = yield* PubSub.unbounded<WorkerEvent>();
    const crashed = yield* Ref.make<Option.Option<string>>(Option.none());
    const sent = yield* Ref.make<ReadonlyArray<WorkerRequest>>([]);
    const requestCount = yield* Ref.make(0);
    const publish = (event: WorkerEvent) =>
      (event._tag === "Crashed" ? Ref.set(crashed, Option.some(event.message)) : Effect.void).pipe(
        Effect.andThen(PubSub.publish(events, event)),
      );
    const send = (request: WorkerRequest) =>
      Ref.update(sent, (requests) => [...requests, request]).pipe(
        Effect.andThen(Effect.forEach(answer(request), publish, { discard: true, concurrency: 1 })),
      );
    const service = Ref.makeUnsafe(
      Option.some({
        send,
        events,
        crashed,
        nextId: Ref.getAndUpdate(requestCount, (count) => count + 1).pipe(Effect.map(String)),
      }),
    );
    return yield* body(sent).pipe(Effect.provideService(AssistantWorker._tag, service));
  });

const ask = () => generateReply([{ role: "user", content: "hi" }], []);

const replied = (id: string, text: string): WorkerEvent => ({ _tag: "Generated", id, text });

describe("assistant worker requests", () => {
  test("an answer for this request resolves it", async () => {
    const reply = await Effect.runPromise(
      withWorker(
        (request) => (request._tag === "Generate" ? [replied(request.id, "hello")] : []),
        () => ask(),
      ),
    );
    expect(reply).toBe("hello");
  });

  test("events for other requests, and progress, do not answer it", async () => {
    const reply = await Effect.runPromise(
      withWorker(
        (request) =>
          request._tag === "Generate"
            ? [
                { _tag: "Progressed", model: "text", loaded: 1, total: 2 },
                replied("someone-else", "wrong"),
                replied(request.id, "right"),
              ]
            : [],
        () => ask(),
      ),
    );
    expect(reply).toBe("right");
  });

  test("a matching failure fails the request with the worker's message", async () => {
    const error = await Effect.runPromise(
      withWorker(
        (request) =>
          request._tag === "Generate"
            ? [{ _tag: "Failed", id: request.id, message: "no model" }]
            : [],
        () => Effect.flip(ask()),
      ),
    );
    expect(error.message).toBe("no model");
  });

  test("a latched crash fails a later request without sending it", async () => {
    const run = await Effect.runPromise(
      withWorker(
        () => [{ _tag: "Crashed", message: "model died" }],
        (sent) =>
          Effect.gen(function* () {
            yield* Effect.flip(ask());
            const before = yield* Ref.get(sent);
            const later = yield* Effect.flip(ask());
            const after = yield* Ref.get(sent);
            return { later, sentNothingMore: after.length === before.length } as const;
          }),
      ),
    );
    expect(run.later.message).toBe("model died");
    expect(run.sentNothingMore).toBe(true);
  });
});

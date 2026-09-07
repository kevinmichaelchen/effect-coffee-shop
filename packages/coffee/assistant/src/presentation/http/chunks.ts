import type { AssistantToolActivity } from "../../application/model.ts";
import * as Clock from "effect/Clock";
import * as Random from "effect/Random";
/**
 * Builds TanStack AI stream chunks and async queues for assistant responses.
 *
 * @module
 */
import { EventType, type StreamChunk } from "@tanstack/ai";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";

export interface AssistantChunkQueue<TChunk> {
  readonly stream: AsyncIterable<TChunk>;
  readonly close: () => void;
  readonly fail: (cause: unknown) => void;
  readonly push: (chunk: TChunk) => void;
}

export type AssistantStreamChunk = StreamChunk;

export function createAssistantChunkQueue<TChunk>(
  signal?: AbortSignal,
): AssistantChunkQueue<TChunk> {
  // oxlint-disable-next-line effect/effect-run-in-body -- Synchronous TanStack async-iterator adapter; queue operations must complete before returning.
  const queue = Effect.runSync(Queue.unbounded<TChunk, unknown>());
  // oxlint-disable-next-line effect/effect-run-in-body -- Synchronous TanStack async-iterator adapter; queue operations must complete before returning.
  const close = () => void Effect.runSync(Queue.end(queue));
  // oxlint-disable-next-line effect/effect-run-in-body -- Synchronous TanStack async-iterator adapter; queue operations must complete before returning.
  const fail = (cause: unknown) => void Effect.runSync(Queue.fail(queue, cause));
  // oxlint-disable-next-line effect/effect-run-in-body -- Synchronous TanStack async-iterator adapter; queue operations must complete before returning.
  const push = (chunk: TChunk) => void Effect.runSync(Queue.offer(queue, chunk));

  signal?.addEventListener("abort", close, { once: true });

  return {
    close,
    fail,
    push,
    stream: Stream.toAsyncIterable(Stream.fromQueue(queue)),
  };
}

export function createAssistantRunStartedChunk(
  timestamp: number,
  runId: string,
  model: string,
): AssistantStreamChunk {
  return {
    type: EventType.RUN_STARTED,
    threadId: runId,
    runId,
    model,
    timestamp,
  };
}

export function createAssistantRunFinishedChunk(
  timestamp: number,
  runId: string,
  model: string,
): AssistantStreamChunk {
  return {
    type: EventType.RUN_FINISHED,
    threadId: runId,
    runId,
    model,
    timestamp,
    finishReason: "stop",
  };
}

export function createAssistantTextStartChunk(
  timestamp: number,
  messageId: string,
  model: string,
): AssistantStreamChunk {
  return {
    type: EventType.TEXT_MESSAGE_START,
    messageId,
    model,
    timestamp,
    role: "assistant",
  };
}

export function createAssistantTextContentChunk(
  timestamp: number,
  messageId: string,
  model: string,
  content: string,
): AssistantStreamChunk {
  return {
    type: EventType.TEXT_MESSAGE_CONTENT,
    messageId,
    model,
    timestamp,
    delta: content,
    content,
  };
}

export function createAssistantTextEndChunk(
  timestamp: number,
  messageId: string,
  model: string,
): AssistantStreamChunk {
  return {
    type: EventType.TEXT_MESSAGE_END,
    messageId,
    model,
    timestamp,
  };
}

export function createAssistantCustomChunk(
  timestamp: number,
  model: string,
  name: string,
  value: AssistantToolActivity,
): AssistantStreamChunk {
  return {
    type: EventType.CUSTOM,
    timestamp,
    model,
    name,
    value,
  };
}

export const createAssistantStreamId = Effect.fn("Assistant.createStreamId")(function* (
  prefix: string,
) {
  const now = yield* Clock.currentTimeMillis;
  const random = yield* Random.next;
  return `${prefix}-${now}-${random.toString(36).slice(2, 9)}`;
});

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
  readonly fail: (error: unknown) => void;
  readonly push: (chunk: TChunk) => void;
}

export type AssistantStreamChunk = StreamChunk;

export function createAssistantChunkQueue<TChunk>(
  signal?: AbortSignal,
): AssistantChunkQueue<TChunk> {
  const queue = Effect.runSync(Queue.unbounded<TChunk, unknown>());
  const close = () => void Effect.runSync(Queue.end(queue));
  const fail = (error: unknown) => void Effect.runSync(Queue.fail(queue, error));
  const push = (chunk: TChunk) => void Effect.runSync(Queue.offer(queue, chunk));

  signal?.addEventListener("abort", close, { once: true });

  return {
    close,
    fail,
    push,
    stream: Stream.toAsyncIterable(Stream.fromQueue(queue)),
  };
}

export function createAssistantRunStartedChunk(runId: string, model: string): AssistantStreamChunk {
  return {
    type: EventType.RUN_STARTED,
    threadId: runId,
    runId,
    model,
    timestamp: Date.now(),
  };
}

export function createAssistantRunFinishedChunk(
  runId: string,
  model: string,
): AssistantStreamChunk {
  return {
    type: EventType.RUN_FINISHED,
    threadId: runId,
    runId,
    model,
    timestamp: Date.now(),
    finishReason: "stop",
  };
}

export function createAssistantTextStartChunk(
  messageId: string,
  model: string,
): AssistantStreamChunk {
  return {
    type: EventType.TEXT_MESSAGE_START,
    messageId,
    model,
    timestamp: Date.now(),
    role: "assistant",
  };
}

export function createAssistantTextContentChunk(
  messageId: string,
  model: string,
  content: string,
): AssistantStreamChunk {
  return {
    type: EventType.TEXT_MESSAGE_CONTENT,
    messageId,
    model,
    timestamp: Date.now(),
    delta: content,
    content,
  };
}

export function createAssistantTextEndChunk(
  messageId: string,
  model: string,
): AssistantStreamChunk {
  return {
    type: EventType.TEXT_MESSAGE_END,
    messageId,
    model,
    timestamp: Date.now(),
  };
}

export function createAssistantCustomChunk(
  model: string,
  name: string,
  value: unknown,
): AssistantStreamChunk {
  return {
    type: EventType.CUSTOM,
    timestamp: Date.now(),
    model,
    name,
    value,
  };
}

export function createAssistantStreamId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Builds TanStack AI stream chunks and async queues for assistant responses.
 *
 * @module
 */
import { EventType, type StreamChunk } from "@tanstack/ai";

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
  const items: TChunk[] = [];
  let failed: unknown;
  let isClosed = false;
  let pendingReject: ((error: unknown) => void) | undefined;
  let pendingResolve: ((result: IteratorResult<TChunk>) => void) | undefined;

  const settlePending = (result: IteratorResult<TChunk>) => {
    pendingReject = undefined;
    pendingResolve?.(result);
    pendingResolve = undefined;
  };

  const fail = (error: unknown) => {
    failed = error;
    isClosed = true;
    pendingResolve = undefined;
    pendingReject?.(error);
    pendingReject = undefined;
  };

  const close = () => {
    isClosed = true;
    settlePending({ value: undefined, done: true });
  };

  const push = (chunk: TChunk) => {
    if (isClosed) {
      return;
    }

    if (pendingResolve) {
      settlePending({ value: chunk, done: false });
      return;
    }

    items.push(chunk);
  };

  signal?.addEventListener("abort", close, { once: true });

  return {
    close,
    fail,
    push,
    stream: {
      async *[Symbol.asyncIterator]() {
        while (true) {
          if (items.length > 0) {
            const next = items.shift();

            if (next !== undefined) {
              yield next;
              continue;
            }
          }

          if (failed !== undefined) {
            throw failed;
          }

          if (isClosed) {
            return;
          }

          const next = await new Promise<IteratorResult<TChunk>>((resolve, reject) => {
            pendingResolve = resolve;
            pendingReject = reject;
          });

          if (next.done) {
            return;
          }

          yield next.value;
        }
      },
    },
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

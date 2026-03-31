import type { AssistantEvent } from "#features/assistant/lib/assistant-loop.ts";
import { defaultLfmCacheStatus, type LfmCacheStatus } from "#features/assistant/lib/lfm-cache.ts";
import type { ModelProgressUpdate } from "#features/assistant/lib/lfm-browser.ts";

export interface DemoMessage {
  readonly content: string;
  readonly id: string;
  readonly role: "assistant" | "user";
}

export interface DemoStatus {
  readonly label: string;
  readonly phase: "error" | "idle" | "loading" | "ready" | "running";
  readonly progress: number;
}

export type DemoCacheStatus = LfmCacheStatus;
export const defaultCacheStatus = defaultLfmCacheStatus;

export const assistantPrompts = [
  "What drinks are on the menu right now?",
  "Place a medium oat latte for Maya with one extra shot.",
  "List open orders and tell me which tickets are ready to pick up.",
] as const;

export const readyStatus: DemoStatus = {
  label: "Type a prompt to start. The first run downloads the browser model if needed.",
  phase: "idle",
  progress: 0,
};

export interface AssistantUiState {
  readonly assistantDraft: string;
  readonly cacheStatus: DemoCacheStatus;
  readonly errorMessage: string | null;
  readonly events: readonly AssistantEvent[];
  readonly hasLoadedModel: boolean;
  readonly input: string;
  readonly messages: readonly DemoMessage[];
  readonly status: DemoStatus;
}

export type AssistantUiMessage =
  | { readonly type: "assistant-completed"; readonly assistantText: string; readonly events: readonly AssistantEvent[]; readonly toolCount: number }
  | { readonly type: "assistant-draft-updated"; readonly text: string }
  | { readonly type: "assistant-failed"; readonly message: string }
  | { readonly type: "assistant-running" }
  | { readonly type: "cache-status-refreshed"; readonly cacheStatus: DemoCacheStatus }
  | { readonly type: "conversation-reset" }
  | { readonly type: "input-changed"; readonly value: string }
  | { readonly type: "model-progressed"; readonly progress: ModelProgressUpdate }
  | { readonly type: "runtime-preparing" }
  | { readonly type: "user-submitted"; readonly prompt: string }
  | { readonly type: "warm-up-completed"; readonly toolCount: number };

export function createInitialAssistantState(): AssistantUiState {
  return {
    assistantDraft: "",
    cacheStatus: defaultCacheStatus,
    errorMessage: null,
    events: [],
    hasLoadedModel: false,
    input: "",
    messages: [],
    status: readyStatus,
  };
}

export function reduceAssistantState(
  state: AssistantUiState,
  message: AssistantUiMessage,
): AssistantUiState {
  return assistantStateReducers[message.type](state, message as never);
}

export function isBusyStatus(status: DemoStatus): boolean {
  return status.phase === "loading" || status.phase === "running";
}

function createMessage(role: DemoMessage["role"], content: string): DemoMessage {
  return {
    content,
    id: crypto.randomUUID(),
    role,
  };
}

function readyToolStatus(toolCount: number): DemoStatus {
  return {
    label: `Model ready in this tab with ${toolCount} Coffee Shop tools.`,
    phase: "ready",
    progress: 100,
  };
}

const runningStatus: DemoStatus = {
  label: "Thinking with local WebGPU",
  phase: "running",
  progress: 100,
};

const assistantStateReducers = {
  "assistant-completed": (
    state: AssistantUiState,
    message: Extract<AssistantUiMessage, { readonly type: "assistant-completed" }>,
  ): AssistantUiState => ({
    ...state,
    assistantDraft: "",
    events: [...state.events, ...message.events],
    hasLoadedModel: true,
    messages: [...state.messages, createMessage("assistant", message.assistantText)],
    status: readyToolStatus(message.toolCount),
  }),
  "assistant-draft-updated": (
    state: AssistantUiState,
    message: Extract<AssistantUiMessage, { readonly type: "assistant-draft-updated" }>,
  ): AssistantUiState => ({
    ...state,
    assistantDraft: message.text,
  }),
  "assistant-failed": (
    state: AssistantUiState,
    message: Extract<AssistantUiMessage, { readonly type: "assistant-failed" }>,
  ): AssistantUiState => ({
    ...state,
    assistantDraft: "",
    errorMessage: message.message,
    status: {
      label: "Local demo unavailable",
      phase: "error",
      progress: 0,
    },
  }),
  "assistant-running": (state: AssistantUiState): AssistantUiState => ({
    ...state,
    status: runningStatus,
  }),
  "cache-status-refreshed": (
    state: AssistantUiState,
    message: Extract<AssistantUiMessage, { readonly type: "cache-status-refreshed" }>,
  ): AssistantUiState => ({
    ...state,
    cacheStatus: message.cacheStatus,
  }),
  "conversation-reset": (state: AssistantUiState): AssistantUiState => ({
    ...state,
    assistantDraft: "",
    events: [],
    messages: [],
    status: readyStatus,
  }),
  "input-changed": (
    state: AssistantUiState,
    message: Extract<AssistantUiMessage, { readonly type: "input-changed" }>,
  ): AssistantUiState => ({
    ...state,
    input: message.value,
  }),
  "model-progressed": (
    state: AssistantUiState,
    message: Extract<AssistantUiMessage, { readonly type: "model-progressed" }>,
  ): AssistantUiState => ({
    ...state,
    status: {
      ...message.progress,
      phase: "loading",
    },
  }),
  "runtime-preparing": (state: AssistantUiState): AssistantUiState => ({
    ...state,
    errorMessage: null,
    status: {
      label: "Preparing local runtime",
      phase: "loading",
      progress: 10,
    },
  }),
  "user-submitted": (
    state: AssistantUiState,
    message: Extract<AssistantUiMessage, { readonly type: "user-submitted" }>,
  ): AssistantUiState => ({
    ...state,
    errorMessage: null,
    input: "",
    messages: [...state.messages, createMessage("user", message.prompt)],
    status: runningStatus,
  }),
  "warm-up-completed": (
    state: AssistantUiState,
    message: Extract<AssistantUiMessage, { readonly type: "warm-up-completed" }>,
  ): AssistantUiState => ({
    ...state,
    hasLoadedModel: true,
    status: readyToolStatus(message.toolCount),
  }),
} satisfies {
  [Key in AssistantUiMessage["type"]]: (
    state: AssistantUiState,
    message: Extract<AssistantUiMessage, { readonly type: Key }>,
  ) => AssistantUiState;
};

import {
  assistantPrompts,
  type AssistantDisplayMessage,
  type AssistantStatus,
  type AssistantToolActivity,
} from "#features/assistant/lib/assistant-chat.ts";

export const storyAssistantMessages: readonly AssistantDisplayMessage[] = [
  {
    id: "user-1",
    role: "user",
    content: "Place a medium oat latte for me with one extra shot.",
  },
  {
    id: "assistant-1",
    role: "assistant",
    content: "Placed a medium oat latte with two total shots. It is now in the queue as C-104.",
  },
];

export const storyAssistantEvents: readonly AssistantToolActivity[] = [
  {
    kind: "tool-call",
    label: "place_order",
    detail: '{\n  "drinkId": "latte",\n  "size": "medium",\n  "milk": "oat",\n  "shots": 2\n}',
  },
  {
    kind: "tool-result",
    label: "place_order",
    detail: '{\n  "id": "C-104",\n  "status": "pending"\n}',
  },
];

export const readyStoryStatus: AssistantStatus = {
  detail: "Same-origin Worker route is open for live menu and order tools.",
  label: "Live route ready",
  phase: "ready",
};

export const runningStoryStatus: AssistantStatus = {
  detail: "Opening the Worker stream for this run.",
  label: "Running on Cloudflare Workers AI",
  phase: "running",
};

export const errorStoryStatus: AssistantStatus = {
  detail: "Workers AI is unavailable. Set Cloudflare credentials for local Bun runs.",
  label: "Assistant unavailable",
  phase: "error",
};

export const storyAssistantPrompts = [...assistantPrompts];

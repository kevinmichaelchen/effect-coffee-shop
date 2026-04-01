import { assistantPrompts, readyStatus, type DemoCacheStatus, type DemoMessage } from "#features/assistant/hooks/lfmAssistantSupport.ts";
import type { AssistantEvent } from "#features/assistant/lib/assistant-loop.ts";

export const storyAssistantMessages: readonly DemoMessage[] = [
  {
    id: "user-1",
    role: "user",
    content: "Place a medium oat latte for Maya with one extra shot.",
  },
  {
    id: "assistant-1",
    role: "assistant",
    content: "Placed a medium oat latte for Maya with two total shots. It is now in the queue as ticket C-104.",
  },
];

export const storyAssistantEvents: readonly AssistantEvent[] = [
  {
    kind: "tool-call",
    label: "place_order",
    detail: "customerName=Maya, drinkId=latte, size=medium, milk=oat, shots=2",
  },
  {
    kind: "tool-result",
    label: "place_order",
    detail: "Created order C-104 in pending state.",
  },
];

export const warmStoryCacheStatus: DemoCacheStatus = {
  phase: "warm",
  label: "This browser already has the core local model assets.",
};

export const coldStoryCacheStatus: DemoCacheStatus = {
  phase: "cold",
  label: "First use may download the model and tokenizer into this browser.",
};

export const storyAssistantPrompts = [...assistantPrompts];
export const storyReadyStatus = readyStatus;

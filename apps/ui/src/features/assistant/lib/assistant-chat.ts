import type { ConnectionStatus, UIMessage } from "@tanstack/ai-client";
import * as Schema from "effect/Schema";

export const assistantPrompts = [
  "What drinks are on the menu right now?",
  "Place a medium oat latte for Maya with one extra shot.",
  "List open orders and tell me which tickets are ready to pick up.",
] as const;

export const assistantToolActivityEvent = "assistant_tool_activity";

export interface AssistantDisplayMessage {
  readonly content: string;
  readonly id: string;
  readonly role: "assistant" | "user";
}

export interface AssistantStatus {
  readonly detail: string;
  readonly label: string;
  readonly phase: "error" | "idle" | "ready" | "running";
}

const AssistantToolActivitySchema = Schema.Struct({
  detail: Schema.String,
  kind: Schema.Literals(["tool-call", "tool-result"] as const),
  label: Schema.String,
});

export type AssistantToolActivity = typeof AssistantToolActivitySchema.Type;

const isAssistantToolActivitySchema = Schema.is(AssistantToolActivitySchema);

export function getAssistantStatus(input: {
  readonly connectionStatus: ConnectionStatus;
  readonly errorMessage: string | null;
  readonly isBusy: boolean;
}): AssistantStatus {
  const { connectionStatus, errorMessage, isBusy } = input;
  if (errorMessage !== null) {
    return {
      detail: errorMessage,
      label: "Assistant unavailable",
      phase: "error",
    };
  }

  if (isBusy) {
    return {
      detail: describeConnectionStatus(connectionStatus),
      label: "Running Beanline",
      phase: "running",
    };
  }

  return {
    detail: describeConnectionStatus(connectionStatus),
    label: connectionStatus === "connected" ? "Live route ready" : "Ready for live coffee actions",
    phase: connectionStatus === "connected" ? "ready" : "idle",
  };
}

export function getDisplayMessages(
  messages: readonly UIMessage[],
): readonly AssistantDisplayMessage[] {
  return messages.flatMap((message) => {
    if (message.role === "system") {
      return [];
    }

    const content = extractMessageText(message);
    if (content === "") {
      return [];
    }

    return [
      {
        content,
        id: message.id,
        role: message.role,
      },
    ];
  });
}

export function isAssistantToolActivity(value: unknown): value is AssistantToolActivity {
  return isAssistantToolActivitySchema(value);
}

function describeConnectionStatus(connectionStatus: ConnectionStatus): string {
  if (connectionStatus === "connected") {
    return "Same-origin Beanline route is open for live menu and order tools.";
  }

  if (connectionStatus === "connecting") {
    return "Opening the Beanline stream for this run.";
  }

  if (connectionStatus === "error") {
    return "The assistant stream hit a connection error.";
  }

  return "The first prompt opens the Beanline stream.";
}

function extractMessageText(message: UIMessage): string {
  return message.parts
    .flatMap((part) => {
      if (part.type === "text" || part.type === "thinking") {
        return [part.content];
      }

      return [];
    })
    .join("\n")
    .trim();
}

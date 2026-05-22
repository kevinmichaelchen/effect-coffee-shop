/**
 * Decodes assistant request bodies and normalizes UI/model messages.
 *
 * @module
 */
import type { AssistantConversationMessage } from "../../application/model.ts";
import * as Schema from "effect/Schema";

const AssistantContentTextPartSchema = Schema.Struct({
  type: Schema.Literal("text"),
  content: Schema.String,
});

const AssistantThinkingPartSchema = Schema.Struct({
  type: Schema.Literal("thinking"),
  content: Schema.String,
});

const AssistantModelMessageSchema = Schema.Struct({
  role: Schema.Literals(["user", "assistant", "tool"] as const),
  content: Schema.Union([Schema.String, Schema.Null, Schema.Array(AssistantContentTextPartSchema)]),
});

const AssistantUiMessageSchema = Schema.Struct({
  id: Schema.String,
  role: Schema.Literals(["system", "user", "assistant"] as const),
  parts: Schema.Array(Schema.Union([AssistantContentTextPartSchema, AssistantThinkingPartSchema])),
});

const AssistantRequestBodySchema = Schema.Struct({
  messages: Schema.Array(Schema.Union([AssistantModelMessageSchema, AssistantUiMessageSchema])),
});

type AssistantModelMessageInput = typeof AssistantModelMessageSchema.Type;
export type AssistantRequestBody = typeof AssistantRequestBodySchema.Type;
type AssistantRequestMessage = (typeof AssistantRequestBodySchema.Type.messages)[number];
type AssistantUiMessageInput = typeof AssistantUiMessageSchema.Type;

const decodeAssistantRequestBody = Schema.decodeUnknownPromise(AssistantRequestBodySchema);
const isAssistantUiMessage = Schema.is(AssistantUiMessageSchema);

export async function parseAssistantRequestBody(
  request: Request,
): Promise<AssistantRequestBody | null> {
  return request
    .json()
    .then(decodeAssistantRequestBody)
    .catch(() => null);
}

export function toAssistantConversationMessages(
  messages: readonly AssistantRequestMessage[],
): readonly AssistantConversationMessage[] {
  return messages.flatMap((message) =>
    isAssistantUiMessage(message)
      ? toAssistantConversationMessagesFromUiMessage(message)
      : toAssistantConversationMessage(message),
  );
}

function extractModelMessageText(content: AssistantModelMessageInput["content"]): string {
  if (content === null) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  return content
    .filter((part) => part.type === "text")
    .map((part) => part.content)
    .join("");
}

function toAssistantConversationMessage(
  message: AssistantModelMessageInput,
): readonly AssistantConversationMessage[] {
  const content = extractModelMessageText(message.content);

  if (content === "") {
    return [];
  }

  if (message.role === "tool") {
    return [
      {
        content,
        name: "tool",
        role: "tool",
      },
    ];
  }

  return [
    {
      role: message.role,
      content,
    },
  ];
}

function toAssistantConversationMessagesFromUiMessage(
  message: AssistantUiMessageInput,
): readonly AssistantConversationMessage[] {
  if (message.role === "system") {
    return [];
  }

  const content = message.parts
    .map((part) => part.content)
    .join("")
    .trim();

  if (content === "") {
    return [];
  }

  return [
    {
      role: message.role,
      content,
    },
  ];
}

/**
 * Decodes assistant request bodies and normalizes UI/model messages.
 *
 * @module
 */
import type { ModelMessage } from "@tanstack/ai";
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

export function toAssistantModelMessages(
  messages: readonly AssistantRequestMessage[],
): readonly ModelMessage[] {
  return messages.flatMap((message) =>
    isAssistantUiMessage(message)
      ? toAssistantModelMessagesFromUiMessage(message)
      : [toAssistantModelMessage(message)],
  );
}

function toAssistantModelMessage(message: AssistantModelMessageInput): ModelMessage {
  if (typeof message.content === "string" || message.content === null) {
    return {
      role: message.role,
      content: message.content,
    };
  }

  return {
    role: message.role,
    content: message.content.map((part) => ({
      type: part.type,
      content: part.content,
    })),
  };
}

function toAssistantModelMessagesFromUiMessage(
  message: AssistantUiMessageInput,
): readonly ModelMessage[] {
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
    } satisfies AssistantModelMessageInput,
  ];
}

import type { ModelMessage } from "@tanstack/ai";
import type { CoffeeActionJsonSchema } from "@effect-coffee-shop/coffee-actions/json-schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Tool from "effect/unstable/ai/Tool";

export interface AssistantToolActivity {
  readonly detail: string;
  readonly kind: "tool-call" | "tool-result";
  readonly label: string;
}

export interface AssistantToolCall {
  readonly arguments: unknown;
  readonly id?: string;
  readonly name: string;
}

export type AssistantConversationMessage =
  | {
      readonly content: string;
      readonly role: "assistant" | "system" | "user";
      readonly toolCalls?: readonly AssistantToolCall[];
    }
  | {
      readonly content: string;
      readonly name: string;
      readonly role: "tool";
    };

export interface AssistantToolDefinition {
  readonly execute: (input: unknown) => Effect.Effect<string>;
  readonly parameters: CoffeeActionJsonSchema;
  readonly tool: Tool.Any;
}

export interface AssistantModelRequest {
  readonly conversation: readonly AssistantConversationMessage[];
  readonly eventId: string | undefined;
  readonly maxTokens: number;
  readonly model: string;
  readonly requestMetadata: AssistantRequestMetadata | undefined;
  readonly tools: readonly AssistantToolDefinition[];
}

export interface AssistantModelResponse {
  readonly text: string;
  readonly toolCalls: readonly AssistantToolCall[];
}

export type AssistantModelError = AssistantModelRequestError | AssistantModelResponseDecodeError;

export class AssistantModelRequestError extends Schema.TaggedErrorClass<AssistantModelRequestError>()(
  "AssistantModelRequestError",
  {
    message: Schema.String,
    provider: Schema.String,
    status: Schema.optionalKey(Schema.Number),
  },
) {}

export class AssistantModelResponseDecodeError extends Schema.TaggedErrorClass<AssistantModelResponseDecodeError>()(
  "AssistantModelResponseDecodeError",
  {
    message: Schema.String,
    provider: Schema.String,
  },
) {}

export class AssistantModelRunner extends Context.Service<
  AssistantModelRunner,
  {
    readonly run: (
      request: AssistantModelRequest,
    ) => Effect.Effect<AssistantModelResponse, AssistantModelError>;
  }
>()("effect-coffee-shop/assistant/AssistantModelRunner") {}

export type AssistantModelRunnerService = Context.Service.Shape<typeof AssistantModelRunner>;

export type AssistantRequestMetadata = Readonly<
  Record<string, boolean | number | string | null | bigint>
>;

const assistantFallbackMessage = "I couldn't generate a final response.";

function extractMessageText(content: ModelMessage["content"]): string {
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

export function extractResponseText(text: string | undefined): string {
  const trimmedText = text?.trim();

  if (!trimmedText) {
    return assistantFallbackMessage;
  }

  return trimmedText;
}

export function getAssistantToolDescription(tool: AssistantToolDefinition): string {
  return tool.tool.description ?? "";
}

export function getAssistantToolName(tool: AssistantToolDefinition): string {
  return tool.tool.name;
}

export function toAssistantConversationMessages(
  messages: readonly ModelMessage[],
  systemPrompt: string,
): AssistantConversationMessage[] {
  return messages.reduce<AssistantConversationMessage[]>(
    (conversation, message) => {
      const converted = toAssistantConversationMessage(message);

      if (converted === null) {
        return conversation;
      }

      return conversation.concat(converted);
    },
    [{ role: "system", content: systemPrompt }],
  );
}

function toAssistantConversationMessage(
  message: ModelMessage,
): AssistantConversationMessage | null {
  const content = extractMessageText(message.content);

  if (content === "") {
    return null;
  }

  if (message.role === "tool") {
    return {
      content,
      name: "tool",
      role: "tool",
    };
  }

  return {
    role: message.role,
    content,
  };
}

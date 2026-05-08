import type {
  AiTextGenerationOutput,
  AiTextGenerationToolLegacyOutput,
  RoleScopedChatInput,
} from "@cloudflare/workers-types";
import type { ModelMessage } from "@tanstack/ai";
import type { AssistantToolDefinition } from "./tools/definitions.ts";

export type AssistantGatewayMetadata = Readonly<
  Record<string, boolean | number | string | null | bigint>
>;

export type AssistantGatewayOptions = Readonly<{
  gateway: Readonly<{
    collectLog: true;
    eventId?: string;
    id: string;
    metadata?: AssistantGatewayMetadata;
  }>;
}>;

export type AssistantRunnableTool = Readonly<{
  description: AssistantToolDefinition["description"];
  name: AssistantToolDefinition["name"];
  parameters?: AssistantToolDefinition["parameters"];
}>;

const assistantFallbackMessage = "I couldn't generate a final response.";

export function createGatewayOptions(
  gatewayId: string | undefined,
  metadata: AssistantGatewayMetadata | undefined,
  eventId: string | undefined,
): AssistantGatewayOptions | undefined {
  const normalizedGatewayId = gatewayId?.trim();

  if (normalizedGatewayId === undefined || normalizedGatewayId === "") {
    return undefined;
  }

  return createGatewayOptionRecord(normalizedGatewayId, eventId, metadata);
}

export function extractAssistantText(output: AiTextGenerationOutput): string {
  const text = output.response?.trim();

  if (!text) {
    return assistantFallbackMessage;
  }

  return text;
}

export function isToolCall(
  value: AiTextGenerationToolLegacyOutput | undefined,
): value is AiTextGenerationToolLegacyOutput {
  return value !== undefined && typeof value.name === "string";
}

export function stripToolExecutor(tool: AssistantToolDefinition): AssistantRunnableTool {
  if (tool.parameters === undefined) {
    return {
      description: tool.description,
      name: tool.name,
    };
  }

  return {
    description: tool.description,
    name: tool.name,
    parameters: tool.parameters,
  };
}

export function toWorkersAiMessages(
  messages: readonly ModelMessage[],
  systemPrompt: string,
): RoleScopedChatInput[] {
  return messages.reduce<RoleScopedChatInput[]>(
    (conversation, message) => {
      const converted = toWorkersAiMessage(message);

      if (converted === null) {
        return conversation;
      }

      return conversation.concat(converted);
    },
    [{ role: "system", content: systemPrompt }],
  );
}

function toWorkersAiMessage(message: ModelMessage): RoleScopedChatInput | null {
  const content = extractMessageText(message.content);

  if (content === "") {
    return null;
  }

  return {
    role: message.role,
    content,
  };
}

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

function createGatewayOptionRecord(
  gatewayId: string,
  eventId: string | undefined,
  metadata: AssistantGatewayMetadata | undefined,
): AssistantGatewayOptions {
  if (eventId === undefined) {
    if (metadata === undefined) {
      return {
        gateway: {
          collectLog: true,
          id: gatewayId,
        },
      };
    }

    return {
      gateway: {
        collectLog: true,
        id: gatewayId,
        metadata,
      },
    };
  }

  if (metadata === undefined) {
    return {
      gateway: {
        collectLog: true,
        eventId,
        id: gatewayId,
      },
    };
  }

  return {
    gateway: {
      collectLog: true,
      eventId,
      id: gatewayId,
      metadata,
    },
  };
}

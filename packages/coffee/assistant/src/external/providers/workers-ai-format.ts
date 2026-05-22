/**
 * Converts assistant messages and tools into Cloudflare Workers AI shapes.
 *
 * @module
 */
import type { RoleScopedChatInput } from "@cloudflare/workers-types";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type {
  AssistantConversationMessage,
  AssistantRequestMetadata,
  AssistantToolCall,
  AssistantToolDefinition,
} from "../../application/model.ts";
import { getAssistantToolDescription, getAssistantToolName } from "../../application/model.ts";

export type AssistantGatewayOptions = Readonly<{
  gateway: Readonly<{
    collectLog: true;
    eventId?: string;
    id: string;
    metadata?: AssistantRequestMetadata;
  }>;
}>;

export type AssistantRunnableTool = Readonly<{
  description: string;
  name: string;
  parameters?: AssistantToolDefinition["parameters"];
}>;

const WorkersAiToolCallSchema = Schema.Struct({
  arguments: Schema.Unknown,
  name: Schema.String,
});

type WorkersAiToolCall = typeof WorkersAiToolCallSchema.Type;
const isWorkersAiToolCall = Schema.is(WorkersAiToolCallSchema);

export function createGatewayOptions(
  gatewayId: string | undefined,
  metadata: AssistantRequestMetadata | undefined,
  eventId: string | undefined,
): AssistantGatewayOptions | undefined {
  const normalizedGatewayId = Option.fromNullishOr(gatewayId?.trim()).pipe(
    Option.filter((id) => id !== ""),
  );

  return normalizedGatewayId.pipe(
    Option.match({
      onNone: () => undefined,
      onSome: (id) =>
        createGatewayOptionRecord(
          id,
          Option.fromNullishOr(eventId),
          Option.fromNullishOr(metadata),
        ),
    }),
  );
}

export function isToolCall(value: unknown): value is WorkersAiToolCall {
  return isWorkersAiToolCall(value);
}

export function toAssistantToolCall(toolCall: WorkersAiToolCall): AssistantToolCall {
  return {
    arguments: toolCall.arguments,
    name: toolCall.name,
  };
}

export function stripToolExecutor(tool: AssistantToolDefinition): AssistantRunnableTool {
  const runnableTool = {
    description: getAssistantToolDescription(tool),
    name: getAssistantToolName(tool),
  };

  return Option.fromNullishOr(tool.parameters).pipe(
    Option.match({
      onNone: () => runnableTool,
      onSome: (parameters) => ({
        ...runnableTool,
        parameters,
      }),
    }),
  );
}

export function toWorkersAiMessages(
  messages: readonly AssistantConversationMessage[],
): RoleScopedChatInput[] {
  return messages.flatMap((message) =>
    toWorkersAiMessage(message).pipe(
      Option.match({
        onNone: () => [],
        onSome: (converted) => [converted],
      }),
    ),
  );
}

function toWorkersAiMessage(
  message: AssistantConversationMessage,
): Option.Option<RoleScopedChatInput> {
  return Match.value(message).pipe(
    Match.when({ content: "" }, () => Option.none<RoleScopedChatInput>()),
    Match.when({ role: "tool" }, (toolMessage) =>
      Option.some({
        content: toolMessage.content,
        name: toolMessage.name,
        role: "tool",
      }),
    ),
    Match.orElse((roleMessage) =>
      Option.some({
        role: roleMessage.role,
        content: roleMessage.content,
      }),
    ),
  );
}

function createGatewayOptionRecord(
  gatewayId: string,
  eventId: Option.Option<string>,
  metadata: Option.Option<AssistantRequestMetadata>,
): AssistantGatewayOptions {
  return {
    gateway: {
      collectLog: true,
      id: gatewayId,
      ...eventId.pipe(
        Option.match({
          onNone: () => ({}),
          onSome: (value) => ({ eventId: value }),
        }),
      ),
      ...metadata.pipe(
        Option.match({
          onNone: () => ({}),
          onSome: (value) => ({ metadata: value }),
        }),
      ),
    },
  };
}

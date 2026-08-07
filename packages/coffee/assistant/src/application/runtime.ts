/**
 * Runs multi-turn assistant tool conversations against a provided model runner.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  type AssistantConversationMessage,
  type AssistantModelError,
  type AssistantRequestMetadata,
  type AssistantToolCall,
  type AssistantToolDefinition,
  AssistantModelRunner,
  getAssistantToolName,
} from "./model.ts";

export type { AssistantModelRunner, AssistantModelRunnerService } from "./model.ts";

const maxAssistantToolRounds = 4;
const assistantMaxTokens = 256;
const assistantToolLoopExhaustedMessage =
  "I couldn't finish the request because the tool loop did not converge.";
const encodeJsonString = Schema.encodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

interface AssistantConversationRoundInput {
  readonly conversation: readonly AssistantConversationMessage[];
  readonly eventId: string | undefined;
  readonly requestMetadata: AssistantRequestMetadata | undefined;
  readonly round: number;
  readonly tools: readonly AssistantToolDefinition[];
}

export function runAssistantConversation(input: {
  readonly eventId?: string;
  readonly messages: readonly AssistantConversationMessage[];
  readonly requestMetadata?: AssistantRequestMetadata;
  readonly systemPrompt: string;
  readonly tools: readonly AssistantToolDefinition[];
}): Effect.Effect<string, AssistantModelError, AssistantModelRunner> {
  const conversation = withSystemPrompt(input.systemPrompt, input.messages);

  return runAssistantConversationRound({
    conversation,
    eventId: input.eventId,
    requestMetadata: input.requestMetadata,
    round: 0,
    tools: input.tools,
  });
}

function runAssistantConversationRound(
  input: AssistantConversationRoundInput,
): Effect.Effect<string, AssistantModelError, AssistantModelRunner> {
  return Effect.gen(function* () {
    const runner = yield* AssistantModelRunner;

    return yield* runner
      .run({
        conversation: input.conversation,
        eventId: input.eventId,
        maxTokens: assistantMaxTokens,
        requestMetadata: input.requestMetadata,
        tools: input.tools,
      })
      .pipe(
        Effect.flatMap((response) => {
          if (response.toolCalls.length === 0) {
            return Effect.succeed(response.text);
          }

          if (input.round === maxAssistantToolRounds) {
            return Effect.succeed(assistantToolLoopExhaustedMessage);
          }

          return appendToolCallMessages(input.conversation, response.toolCalls, input.tools).pipe(
            Effect.flatMap((conversation) =>
              runAssistantConversationRound({
                conversation,
                eventId: input.eventId,
                requestMetadata: input.requestMetadata,
                round: input.round + 1,
                tools: input.tools,
              }),
            ),
          );
        }),
      );
  });
}

function appendToolCallMessages(
  conversation: readonly AssistantConversationMessage[],
  toolCalls: readonly AssistantToolCall[],
  tools: readonly AssistantToolDefinition[],
): Effect.Effect<readonly AssistantConversationMessage[]> {
  return Effect.forEach(
    toolCalls,
    (toolCall) =>
      executeToolCall(toolCall, tools).pipe(
        Effect.map((content): readonly AssistantConversationMessage[] => [
          {
            role: "assistant",
            content: encodeJsonString(toolCall),
            toolCalls: [toolCall],
          },
          {
            content,
            name: toolCall.name,
            role: "tool",
          },
        ]),
      ),
    { concurrency: 1 },
  ).pipe(Effect.map((messages) => conversation.concat(messages.flat())));
}

function executeToolCall(
  toolCall: AssistantToolCall,
  tools: readonly AssistantToolDefinition[],
): Effect.Effect<string> {
  const selectedTool = tools.find((tool) => getAssistantToolName(tool) === toolCall.name);

  if (!selectedTool) {
    return Effect.succeed(`Unknown tool requested: ${toolCall.name}`);
  }

  return selectedTool.execute(toolCall.arguments);
}

function withSystemPrompt(
  systemPrompt: string,
  messages: readonly AssistantConversationMessage[],
): readonly AssistantConversationMessage[] {
  return [
    {
      role: "system",
      content: systemPrompt,
    },
    ...messages,
  ];
}

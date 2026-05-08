import type {
  AiTextGenerationInput,
  AiTextGenerationOutput,
  AiTextGenerationToolLegacyOutput,
  RoleScopedChatInput,
} from "@cloudflare/workers-types";
import { runWorkersAiOverRest } from "./rest.ts";
import type { AssistantToolDefinition } from "./tools/definitions.ts";
import {
  createGatewayOptions,
  extractAssistantText,
  isToolCall,
  stripToolExecutor,
  toWorkersAiMessages,
  type AssistantGatewayMetadata,
  type AssistantGatewayOptions,
  type AssistantRunnableTool,
} from "./workers-ai-format.ts";
import type { ModelMessage } from "@tanstack/ai";

const maxAssistantToolRounds = 4;
const assistantMaxTokens = 256;
const defaultAssistantModel = "@cf/meta/llama-3.1-8b-instruct-fast";
const assistantToolLoopExhaustedMessage =
  "I couldn't finish the request because the tool loop did not converge.";

interface WorkersAiBinding {
  run(
    model: string,
    inputs: AiTextGenerationInput,
    options?: AssistantGatewayOptions,
  ): Promise<AiTextGenerationOutput>;
}

export type AssistantAiConfig =
  | {
      readonly kind: "binding";
      readonly binding: WorkersAiBinding;
      readonly gatewayId?: string;
    }
  | {
      readonly kind: "rest";
      readonly accountId: string;
      readonly apiKey: string;
    };

interface AssistantAiRunner {
  readonly run: (
    model: string,
    inputs: AiTextGenerationInput,
    metadata?: AssistantGatewayMetadata,
    eventId?: string,
  ) => Promise<AiTextGenerationOutput>;
}

interface AssistantConversationRoundInput {
  readonly availableTools: readonly AssistantRunnableTool[];
  readonly conversation: RoleScopedChatInput[];
  readonly gatewayEventId: string | undefined;
  readonly gatewayMetadata: AssistantGatewayMetadata | undefined;
  readonly model: string;
  readonly round: number;
  readonly runner: AssistantAiRunner;
  readonly tools: readonly AssistantToolDefinition[];
}

export function getBunAssistantAiConfig(
  env: Record<string, string | undefined>,
): AssistantAiConfig | undefined {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiKey = env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiKey) {
    return undefined;
  }

  return {
    kind: "rest",
    accountId,
    apiKey,
  };
}

export function getAssistantModel(env?: Record<string, string | undefined>): string {
  const model = env?.COFFEE_ASSISTANT_MODEL?.trim();

  if (!model) {
    return defaultAssistantModel;
  }

  return model;
}

export async function runAssistantConversation(input: {
  readonly ai: AssistantAiConfig;
  readonly gatewayEventId?: string;
  readonly gatewayMetadata?: AssistantGatewayMetadata;
  readonly messages: readonly ModelMessage[];
  readonly model: string;
  readonly systemPrompt: string;
  readonly tools: readonly AssistantToolDefinition[];
}): Promise<string> {
  const runner = createAssistantAiRunner(input.ai);
  const conversation = toWorkersAiMessages(input.messages, input.systemPrompt);
  const availableTools = input.tools.map(stripToolExecutor);

  return runAssistantConversationRound({
    availableTools,
    conversation,
    gatewayEventId: input.gatewayEventId,
    gatewayMetadata: input.gatewayMetadata,
    model: input.model,
    round: 0,
    runner,
    tools: input.tools,
  });
}

async function runAssistantConversationRound(
  input: AssistantConversationRoundInput,
): Promise<string> {
  const response = await input.runner.run(
    input.model,
    {
      max_tokens: assistantMaxTokens,
      messages: input.conversation,
      tools: input.availableTools,
    },
    input.gatewayMetadata,
    input.gatewayEventId,
  );
  const toolCalls = response.tool_calls?.filter(isToolCall) ?? [];

  if (toolCalls.length === 0) {
    return extractAssistantText(response);
  }

  if (input.round === maxAssistantToolRounds) {
    return assistantToolLoopExhaustedMessage;
  }

  await appendToolCallMessages(input.conversation, toolCalls, input.tools);

  return runAssistantConversationRound({
    availableTools: input.availableTools,
    conversation: input.conversation,
    gatewayEventId: input.gatewayEventId,
    gatewayMetadata: input.gatewayMetadata,
    model: input.model,
    round: input.round + 1,
    runner: input.runner,
    tools: input.tools,
  });
}

function createAssistantAiRunner(config: AssistantAiConfig): AssistantAiRunner {
  if (config.kind === "binding") {
    return {
      run: async (model, inputs, metadata, eventId) => {
        const options = createGatewayOptions(config.gatewayId, metadata, eventId);

        if (options === undefined) {
          return config.binding.run(model, inputs);
        }

        return config.binding.run(model, inputs, options);
      },
    };
  }

  return {
    run: async (model, inputs) =>
      runWorkersAiOverRest({
        accountId: config.accountId,
        apiKey: config.apiKey,
        model,
        request: inputs,
      }),
  };
}

async function appendToolCallMessages(
  conversation: RoleScopedChatInput[],
  toolCalls: readonly AiTextGenerationToolLegacyOutput[],
  tools: readonly AssistantToolDefinition[],
): Promise<void> {
  for (const toolCall of toolCalls) {
    conversation.push({ role: "assistant", content: JSON.stringify(toolCall) });
    conversation.push({
      content: await executeToolCall(toolCall, tools),
      name: toolCall.name,
      role: "tool",
    });
  }
}

async function executeToolCall(
  toolCall: AiTextGenerationToolLegacyOutput,
  tools: readonly AssistantToolDefinition[],
): Promise<string> {
  const selectedTool = tools.find((tool) => tool.name === toolCall.name);

  if (!selectedTool) {
    return `Unknown tool requested: ${toolCall.name}`;
  }

  return selectedTool.execute(toolCall.arguments);
}

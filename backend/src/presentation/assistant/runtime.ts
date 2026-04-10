import type {
  AiTextGenerationInput,
  AiTextGenerationOutput,
  AiTextGenerationToolLegacyOutput,
  RoleScopedChatInput,
} from "@cloudflare/workers-types";
import type { ModelMessage } from "@tanstack/ai";
import { runWorkersAiOverRest } from "./rest.ts";
import type { AssistantToolDefinition } from "./tools.ts";

const maxAssistantToolRounds = 4;
const assistantMaxTokens = 384;

interface WorkersAiBinding {
  run(
    model: string,
    inputs: AiTextGenerationInput,
    options?: Record<string, unknown>,
  ): Promise<AiTextGenerationOutput>;
}

export type AssistantAiConfig =
  | {
      readonly binding: WorkersAiBinding;
    }
  | {
      readonly accountId: string;
      readonly apiKey: string;
    };

interface AssistantAiRunner {
  readonly run: (model: string, inputs: AiTextGenerationInput) => Promise<AiTextGenerationOutput>;
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
    accountId,
    apiKey,
  };
}

export function getAssistantModel(env?: Record<string, string | undefined>): string {
  const model = env?.COFFEE_ASSISTANT_MODEL?.trim();
  return model || getDefaultAssistantModel();
}

export async function runAssistantConversation(input: {
  readonly ai: AssistantAiConfig;
  readonly messages: readonly ModelMessage[];
  readonly model: string;
  readonly systemPrompt: string;
  readonly tools: readonly AssistantToolDefinition[];
}): Promise<string> {
  const runner = createAssistantAiRunner(input.ai);
  const conversation = toWorkersAiMessages(input.messages, input.systemPrompt);
  const availableTools = input.tools.map(stripToolExecutor);

  for (let round = 0; round <= maxAssistantToolRounds; round++) {
    const response = await runner.run(input.model, {
      max_tokens: assistantMaxTokens,
      messages: conversation,
      tools: availableTools,
    });
    const toolCalls = response.tool_calls?.filter(isToolCall) ?? [];

    if (toolCalls.length === 0) {
      return extractAssistantText(response);
    }

    if (round === maxAssistantToolRounds) {
      return exhaustedToolLoopMessage();
    }

    await appendToolCallMessages(conversation, toolCalls, input.tools);
  }

  return exhaustedToolLoopMessage();
}

function createAssistantAiRunner(config: AssistantAiConfig): AssistantAiRunner {
  if ("binding" in config) {
    return {
      run: async (model, inputs) => config.binding.run(model, inputs),
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
    conversation.push({
      role: "assistant",
      content: JSON.stringify(toolCall),
    });
    conversation.push({
      role: "tool",
      content: await executeToolCall(toolCall, tools),
      name: toolCall.name,
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

function toWorkersAiMessages(
  messages: readonly ModelMessage[],
  systemPrompt: string,
): RoleScopedChatInput[] {
  const conversation: RoleScopedChatInput[] = [{ role: "system", content: systemPrompt }];

  for (const message of messages) {
    const converted = toWorkersAiMessage(message);

    if (converted) {
      conversation.push(converted);
    }
  }

  return conversation;
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
  if (typeof content === "string") {
    return content;
  }

  if (content === null) {
    return "";
  }

  return content
    .filter((part) => part.type === "text")
    .map((part) => part.content)
    .join("");
}

function stripToolExecutor(tool: AssistantToolDefinition) {
  return {
    description: tool.description,
    name: tool.name,
    parameters: tool.parameters,
  };
}

function isToolCall(
  value: AiTextGenerationToolLegacyOutput | undefined,
): value is AiTextGenerationToolLegacyOutput {
  return value !== undefined && typeof value.name === "string";
}

function extractAssistantText(output: AiTextGenerationOutput): string {
  const text = output.response?.trim();

  if (text) {
    return text;
  }

  return "I couldn't generate a final response.";
}

function exhaustedToolLoopMessage(): string {
  return "I couldn't finish the request because the tool loop did not converge.";
}

function getDefaultAssistantModel(): string {
  return "@hf/nousresearch/hermes-2-pro-mistral-7b";
}

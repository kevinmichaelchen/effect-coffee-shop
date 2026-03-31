import { LfmBrowserModel, type BrowserChatMessage } from "#lib/lfm-browser";
import { CoffeeMcpClient, type McpToolCallResult, type PromptToolDefinition } from "#lib/mcp-client";
import {
  createDirectToolAnswer,
  createToolResultContext,
  formatSyntheticToolCall,
  formatToolCatalog,
  inferForcedToolCall,
  summarizeToolResult,
} from "#lib/assistantTooling";
import { extractToolCall, sanitizeAssistantText } from "#lib/tool-call-parser";

const MAX_TOOL_STEPS = 3;
const TOOL_TOKEN_LIMIT = 96;
const ANSWER_TOKEN_LIMIT = 192;

export interface AssistantEvent {
  readonly detail: string;
  readonly kind: "tool-call" | "tool-result";
  readonly label: string;
}

export interface AssistantTurnResult {
  readonly assistantText: string;
  readonly conversation: readonly BrowserChatMessage[];
  readonly events: readonly AssistantEvent[];
}

export async function processAssistantTurn(input: {
  readonly client: CoffeeMcpClient;
  readonly conversation: readonly BrowserChatMessage[];
  readonly model: LfmBrowserModel;
  readonly onDraft?: (text: string) => void;
  readonly tools: readonly PromptToolDefinition[];
}): Promise<AssistantTurnResult> {
  const { client, conversation, model, onDraft, tools } = input;
  const events: AssistantEvent[] = [];
  const history: BrowserChatMessage[] = [...conversation];

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const stepResult = await runAssistantStep({ client, events, history, model, onDraft, step, tools });
    if (stepResult !== null) {
      return stepResult;
    }
  }

  throw new Error("The local model kept looping on tools without producing a final answer.");
}

function withSystemPrompt(
  conversation: readonly BrowserChatMessage[],
  tools: readonly PromptToolDefinition[],
): readonly BrowserChatMessage[] {
  return [
    {
      content: buildSystemPrompt(tools),
      role: "system",
    },
    ...conversation,
  ];
}

function buildSystemPrompt(tools: readonly PromptToolDefinition[]): string {
  return [
    "You are Beanline, a browser-side coffee concierge for the Onion Coffee Shop.",
    "You do have live access to current Coffee Shop data through MCP tools.",
    "For menu questions, call list_menu before answering.",
    "For order status, queue, ready-ticket, or pickup questions, call list_orders or get_order before answering.",
    "For order creation or updates, use Coffee Shop tools instead of saying you lack access.",
    "Call at most one tool at a time.",
    "When you call a tool, answer with one Pythonic tool list between <|tool_call_start|> and <|tool_call_end|> in this exact shape: [tool_name(arg=\"value\")]. Use [list_menu()] for empty arguments.",
    "After you receive a tool result, explain the outcome in plain English with no markdown tables.",
    "Never say you do not have real-time access when a matching tool exists.",
    `Available tools:\n${formatToolCatalog(tools)}`,
  ].join("\n");
}

function createToolCallEvent(name: string, arguments_: Record<string, unknown>): AssistantEvent {
  return {
    detail: JSON.stringify(arguments_),
    kind: "tool-call",
    label: name,
  };
}

function createToolResultEvent(name: string, result: McpToolCallResult): AssistantEvent {
  return {
    detail: summarizeToolResult(result),
    kind: "tool-result",
    label: name,
  };
}

async function appendToolRound(
  input: {
    client: CoffeeMcpClient;
    events: AssistantEvent[];
    history: BrowserChatMessage[];
    rawAssistant: string;
    toolCall: NonNullable<ReturnType<typeof extractToolCall>>;
  },
): Promise<McpToolCallResult> {
  const { client, events, history, rawAssistant, toolCall } = input;
  const toolResult = await client.callTool(toolCall.name, toolCall.arguments);
  events.push(createToolCallEvent(toolCall.name, toolCall.arguments));
  events.push(createToolResultEvent(toolCall.name, toolResult));
  history.push({ content: rawAssistant, role: "assistant" });
  history.push({ content: createToolResultContext(toolCall.name, toolResult), role: "user" });
  return toolResult;
}

async function runAssistantStep(input: {
  client: CoffeeMcpClient;
  events: AssistantEvent[];
  history: BrowserChatMessage[];
  model: LfmBrowserModel;
  onDraft: ((text: string) => void) | undefined;
  step: number;
  tools: readonly PromptToolDefinition[];
}): Promise<AssistantTurnResult | null> {
  const { client, events, history, model, onDraft, step, tools } = input;
  const generation = await generateAssistantMessage({ history, model, onDraft, step, tools });
  const toolCall = generation.toolCall ?? inferForcedToolCall(history, step);
  if (toolCall === null) {
    history.push({ content: generation.rawAssistant, role: "assistant" });
    return { assistantText: generation.assistantText, conversation: history, events };
  }

  const toolResult = await appendToolRound({
    client,
    events,
    history,
    rawAssistant: generation.toolCall === null ? formatSyntheticToolCall(toolCall) : generation.rawAssistant,
    toolCall,
  });
  return finalizeToolRound({ events, history, onDraft, toolCall, toolResult });
}

async function generateAssistantMessage(input: {
  history: readonly BrowserChatMessage[];
  model: LfmBrowserModel;
  onDraft: ((text: string) => void) | undefined;
  step: number;
  tools: readonly PromptToolDefinition[];
}) {
  const { history, model, onDraft, step, tools } = input;
  const rawAssistant = await model.generate(
    withSystemPrompt(history, tools),
    step === 0 ? TOOL_TOKEN_LIMIT : ANSWER_TOKEN_LIMIT,
    (text) => onDraft?.(sanitizeAssistantText(text)),
  );

  return {
    assistantText: sanitizeAssistantText(rawAssistant),
    rawAssistant,
    toolCall: extractToolCall(rawAssistant),
  };
}

function finalizeToolRound(input: {
  events: readonly AssistantEvent[];
  history: BrowserChatMessage[];
  onDraft: ((text: string) => void) | undefined;
  toolCall: NonNullable<ReturnType<typeof extractToolCall>>;
  toolResult: McpToolCallResult;
}): AssistantTurnResult | null {
  const { events, history, onDraft, toolCall, toolResult } = input;
  const directAnswer = createDirectToolAnswer(toolCall.name, toolResult);
  onDraft?.("");
  if (directAnswer === null) {
    return null;
  }

  history.push({ content: directAnswer, role: "assistant" });
  return { assistantText: directAnswer, conversation: history, events };
}

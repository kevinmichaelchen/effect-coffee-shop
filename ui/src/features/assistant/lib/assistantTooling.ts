import type { BrowserChatMessage } from "#features/assistant/lib/lfm-browser.ts";
import { sanitizeToolArguments, type McpToolCallResult, type PromptToolDefinition } from "#features/assistant/lib/mcp-client.ts";
import type { ParsedToolCall } from "#features/assistant/lib/tool-call-parser.ts";

export function inferForcedToolCall(
  conversation: readonly BrowserChatMessage[],
  step: number,
): ParsedToolCall | null {
  if (step > 0) {
    return null;
  }

  const prompt = [...conversation].reverse().find((message) => message.role === "user")?.content ?? "";
  return /\b(menu|drink|drinks|available|serving|serve)\b/i.test(prompt)
    ? { arguments: {}, name: "list_menu" }
    : null;
}

export function formatSyntheticToolCall(toolCall: ParsedToolCall): string {
  const argumentsText = Object.entries(toolCall.arguments)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(", ");
  return `<|tool_call_start|>[${toolCall.name}(${argumentsText})]<|tool_call_end|>`;
}

export function formatToolCatalog(tools: readonly PromptToolDefinition[]): string {
  return tools
    .map((tool) => `${tool.name}: ${tool.description} | parameters: ${JSON.stringify(tool.parameters)}`)
    .join("\n");
}

export function normalizeToolCall(
  toolCall: ParsedToolCall,
  tools: readonly PromptToolDefinition[],
): ParsedToolCall {
  const tool = tools.find((candidate) => candidate.name === toolCall.name);
  return {
    ...toolCall,
    arguments: sanitizeToolArguments(tool?.parameters, toolCall.arguments),
  };
}

export function formatToolArgumentsDetail(arguments_: Record<string, unknown>): string {
  return formatToolPayload(arguments_);
}

export function formatToolResultDetail(result: McpToolCallResult): string {
  return formatToolPayload(result.structuredContent ?? result.content ?? []);
}

export function createToolResultContext(name: string, result: McpToolCallResult): string {
  return [
    `Live MCP tool result from ${name}: ${stringifyToolResult(result)}`,
    "Use this live result to answer the original user request.",
    "Do not say you lack real-time access.",
  ].join(" ");
}

export function createDirectToolAnswer(name: string, result: McpToolCallResult): string | null {
  if (name !== "list_menu" || !Array.isArray(result.structuredContent)) {
    return null;
  }

  const menuLines = result.structuredContent
    .filter(isMenuItem)
    .map((item) =>
      `- ${item.name} from ${formatPrice(item.basePriceCents)}. Temperatures: ${item.availableTemperatures.join(", ")}. Milks: ${item.availableMilks.join(", ")}.`,
    );
  return menuLines.length === 0 ? null : ["The menu right now is:", ...menuLines].join("\n");
}

function stringifyToolResult(result: McpToolCallResult): string {
  if (result.structuredContent !== undefined) {
    return JSON.stringify(result.structuredContent);
  }

  return JSON.stringify(result.content ?? []);
}

function formatToolPayload(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }

  return JSON.stringify(payload, null, 2) ?? String(payload);
}

function isMenuItem(value: unknown): value is {
  availableMilks: readonly string[];
  availableTemperatures: readonly string[];
  basePriceCents: number;
  name: string;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.basePriceCents === "number" &&
    Array.isArray(candidate.availableMilks) &&
    Array.isArray(candidate.availableTemperatures)
  );
}

function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}

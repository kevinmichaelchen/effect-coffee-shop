import type { BrowserChatMessage } from "#lib/lfm-browser";
import type { McpToolCallResult, PromptToolDefinition } from "#lib/mcp-client";
import type { ParsedToolCall } from "#lib/tool-call-parser";

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

export function summarizeToolResult(result: McpToolCallResult): string {
  const summary = stringifyToolResult(result);
  return summary.length <= 180 ? summary : `${summary.slice(0, 177)}...`;
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

const TOOL_BLOCK_PATTERN = /<\|tool_call_start\|>\s*([\s\S]*?)\s*<\|tool_call_end\|>/;

export interface ParsedToolCall {
  readonly arguments: Record<string, unknown>;
  readonly name: string;
}

export function extractToolCall(text: string): ParsedToolCall | null {
  const match = TOOL_BLOCK_PATTERN.exec(text);
  if (match === null) {
    return null;
  }

  const block = unwrapToolList(match[1] ?? "");
  const toolMatch = /^([a-z_]\w*)\(([\s\S]*)\)$/i.exec(block);
  const name = toolMatch?.[1];
  const argumentsText = toolMatch?.[2];
  if (name === undefined || argumentsText === undefined) {
    return null;
  }

  return {
    arguments: parseArguments(argumentsText),
    name,
  };
}

export function sanitizeAssistantText(text: string): string {
  return stripSpecialTokens(stripToolCallBlock(text)).trim();
}

function stripToolCallBlock(text: string): string {
  return text.replace(TOOL_BLOCK_PATTERN, " ");
}

function stripSpecialTokens(text: string): string {
  return text
    .replaceAll("<|im_end|>", " ")
    .replaceAll("<|startoftext|>", " ")
    .replaceAll("<|endoftext|>", " ")
    .replaceAll("<|im_start|>assistant", " ")
    .replace(/\s+/g, " ");
}

function unwrapToolList(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return trimmed;
  }

  return trimmed.slice(1, -1).trim();
}

function parseArguments(text: string): Record<string, unknown> {
  if (text.trim() === "") {
    return {};
  }

  return Object.fromEntries(splitArguments(text).map(parseAssignment));
}

function splitArguments(text: string): readonly string[] {
  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const character of text) {
    if (isArgumentBoundary(character, quote)) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    quote = nextQuoteState(character, quote);
    current += character;
  }

  if (current.trim() !== "") {
    parts.push(current.trim());
  }

  return parts;
}

function isArgumentBoundary(character: string, quote: '"' | "'" | null): boolean {
  return quote === null && character === ",";
}

function nextQuoteState(
  character: string,
  quote: '"' | "'" | null,
): '"' | "'" | null {
  if (character !== '"' && character !== "'") {
    return quote;
  }

  return quote === character ? null : (quote ?? character);
}

function parseAssignment(part: string): readonly [string, unknown] {
  const separatorIndex = part.indexOf("=");
  if (separatorIndex === -1) {
    throw new Error(`Invalid tool argument: ${part}`);
  }

  const key = part.slice(0, separatorIndex).trim();
  const value = part.slice(separatorIndex + 1).trim();
  return [key, parseLiteral(value)];
}

function parseLiteral(value: string): unknown {
  if (value === "None" || value === "null") {
    return null;
  }

  if (value === "True" || value === "true") {
    return true;
  }

  if (value === "False" || value === "false") {
    return false;
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value.replace(/^['"]|['"]$/g, "");
}

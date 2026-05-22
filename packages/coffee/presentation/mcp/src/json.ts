/**
 * Formats MCP resource and prompt payloads as stable JSON.
 *
 * @module
 */
import * as Formatter from "effect/Formatter";

export const prettyJson = (value: unknown): string => Formatter.formatJson(value, { space: 2 });

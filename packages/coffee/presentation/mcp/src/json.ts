/**
 * Formats MCP resource and prompt payloads as stable JSON.
 *
 * @module
 */
import * as Formatter from "effect/Formatter";
import type * as Schema from "effect/Schema";

export const prettyJson = (value: Schema.Json): string => Formatter.formatJson(value, { space: 2 });

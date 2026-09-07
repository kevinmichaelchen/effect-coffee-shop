/**
 * Formats MCP resource and prompt payloads as stable JSON.
 *
 * @module
 */
import * as Formatter from "effect/Formatter";

// oxlint-disable-next-line effect/no-unknown-parameters -- Serialization boundary accepts arbitrary values and validates/formats them before transport.
export const prettyJson = (value: unknown): string => Formatter.formatJson(value, { space: 2 });

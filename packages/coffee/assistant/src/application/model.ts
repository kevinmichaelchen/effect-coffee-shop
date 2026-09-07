/**
 * Defines assistant model, tool, runner, and provider error types.
 *
 * @module
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as JsonSchema from "effect/JsonSchema";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

const AssistantToolActivity = Schema.Struct({
  detail: Schema.String,
  kind: Schema.Literals(["tool-call", "tool-result"] as const),
  label: Schema.String,
});

const AssistantToolCall = Schema.Struct({
  arguments: Schema.Unknown,
  id: Schema.optionalKey(Schema.String),
  name: Schema.String,
});

export type AssistantToolActivity = typeof AssistantToolActivity.Type;
export type AssistantToolCall = typeof AssistantToolCall.Type;

export type AssistantConversationMessage =
  | {
      readonly content: string;
      readonly role: "assistant" | "system" | "user";
      readonly toolCalls?: readonly AssistantToolCall[];
    }
  | {
      readonly content: string;
      readonly name: string;
      readonly role: "tool";
    };

export interface AssistantToolDefinition {
  readonly description: string;
  // oxlint-disable-next-line effect/no-unknown-parameters -- Tool input decoder boundary: provider payloads remain unknown until the selected Schema decodes them.
  readonly execute: (input: unknown) => Effect.Effect<string>;
  readonly name: string;
  readonly parameters: AssistantToolParameters;
}

export type AssistantToolParameters = JsonSchema.JsonSchema;

export interface AssistantModelRequest {
  readonly conversation: readonly AssistantConversationMessage[];
  // oxlint-disable-next-line effect/prefer-option-over-null -- Workers AI request/metadata contract permits absent fields and native JSON null values.
  readonly eventId: string | undefined;
  readonly maxTokens: number;
  // oxlint-disable-next-line effect/prefer-option-over-null -- Workers AI request/metadata contract permits absent fields and native JSON null values.
  readonly requestMetadata: AssistantRequestMetadata | undefined;
  readonly tools: readonly AssistantToolDefinition[];
}

export interface AssistantModelResponse {
  readonly text: string;
  readonly toolCalls: readonly AssistantToolCall[];
}

export type AssistantModelError = AssistantModelRequestError | AssistantModelResponseDecodeError;

export class AssistantModelRequestError extends Schema.TaggedError<AssistantModelRequestError>()(
  "AssistantModelRequestError",
  {
    message: Schema.String,
    provider: Schema.String,
    status: Schema.optionalKey(Schema.Number),
  },
) {}

export class AssistantModelResponseDecodeError extends Schema.TaggedError<AssistantModelResponseDecodeError>()(
  "AssistantModelResponseDecodeError",
  {
    message: Schema.String,
    provider: Schema.String,
  },
) {}

export class AssistantModelRunner extends Context.Service<
  AssistantModelRunner,
  {
    readonly run: (
      request: AssistantModelRequest,
    ) => Effect.Effect<AssistantModelResponse, AssistantModelError>;
  }
>()("effect-coffee-shop/assistant/AssistantModelRunner") {}

// oxlint-disable-next-line effect/no-shape-in-symbol-names -- Context.Service.Shape is an upstream Effect type member, not an application symbol.
export type AssistantModelRunnerService = Context.Service.Shape<typeof AssistantModelRunner>;

export type AssistantRequestMetadata = Readonly<
  // oxlint-disable-next-line effect/prefer-option-over-null -- Workers AI request/metadata contract permits absent fields and native JSON null values.
  Record<string, boolean | number | string | null | bigint>
>;

const assistantFallbackMessage = "I couldn't generate a final response.";

// oxlint-disable-next-line effect/prefer-option-over-null -- Workers AI request/metadata contract permits absent fields and native JSON null values.
export function extractResponseText(text: string | undefined): string {
  return Option.fromUndefinedOr(text).pipe(
    Option.map(Str.trim),
    Option.filter(Str.isNonEmpty),
    Option.getOrElse(() => assistantFallbackMessage),
  );
}

export function getAssistantToolDescription(tool: AssistantToolDefinition): string {
  return tool.description;
}

export function getAssistantToolName(tool: AssistantToolDefinition): string {
  return tool.name;
}

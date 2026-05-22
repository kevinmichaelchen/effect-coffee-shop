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

const AssistantToolActivitySchema = Schema.Struct({
  detail: Schema.String,
  kind: Schema.Literals(["tool-call", "tool-result"] as const),
  label: Schema.String,
});

const AssistantToolCallSchema = Schema.Struct({
  arguments: Schema.Unknown,
  id: Schema.optionalKey(Schema.String),
  name: Schema.String,
});

export type AssistantToolActivity = typeof AssistantToolActivitySchema.Type;
export type AssistantToolCall = typeof AssistantToolCallSchema.Type;

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
  readonly execute: (input: unknown) => Effect.Effect<string>;
  readonly name: string;
  readonly parameters: AssistantToolParameters;
}

export type AssistantToolParameters = JsonSchema.JsonSchema;

export interface AssistantModelRequest {
  readonly conversation: readonly AssistantConversationMessage[];
  readonly eventId: string | undefined;
  readonly maxTokens: number;
  readonly requestMetadata: AssistantRequestMetadata | undefined;
  readonly tools: readonly AssistantToolDefinition[];
}

export interface AssistantModelResponse {
  readonly text: string;
  readonly toolCalls: readonly AssistantToolCall[];
}

export type AssistantModelError = AssistantModelRequestError | AssistantModelResponseDecodeError;

export class AssistantModelRequestError extends Schema.TaggedErrorClass<AssistantModelRequestError>()(
  "AssistantModelRequestError",
  {
    message: Schema.String,
    provider: Schema.String,
    status: Schema.optionalKey(Schema.Number),
  },
) {}

export class AssistantModelResponseDecodeError extends Schema.TaggedErrorClass<AssistantModelResponseDecodeError>()(
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

export type AssistantModelRunnerService = Context.Service.Shape<typeof AssistantModelRunner>;

export type AssistantRequestMetadata = Readonly<
  Record<string, boolean | number | string | null | bigint>
>;

const assistantFallbackMessage = "I couldn't generate a final response.";

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

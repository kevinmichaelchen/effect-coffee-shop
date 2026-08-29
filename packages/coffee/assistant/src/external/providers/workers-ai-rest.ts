/**
 * Runs assistant requests against Cloudflare Workers AI over REST.
 *
 * @module
 */
import type {
  AiTextGenerationInput,
  AiTextGenerationOutput,
  AiTextGenerationToolLegacyOutput,
  AiTextGenerationToolOutput,
} from "@cloudflare/workers-types";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import {
  AssistantModelRequestError,
  AssistantModelResponseDecodeError,
} from "../../application/model.ts";
import {
  createProviderStatusMessage,
  decodeJsonResponseEffect,
  decodeJsonTextEffect,
  postJsonResponse,
  type ProviderHttpClient,
  readResponseText,
} from "./provider-http.ts";

const WorkersAiToolCallSchema = Schema.Struct({
  arguments: Schema.Unknown,
  name: Schema.String,
});

const WorkersAiUsageSchema = Schema.Struct({
  completion_tokens: Schema.Number,
  prompt_tokens: Schema.Number,
  total_tokens: Schema.Number,
});

const WorkersAiOutputSchema = Schema.Struct({
  response: Schema.optionalKey(Schema.String),
  tool_calls: Schema.optionalKey(Schema.Array(WorkersAiToolCallSchema)),
  usage: Schema.optionalKey(WorkersAiUsageSchema),
});

const WorkersAiEnvelopeSchema = Schema.Struct({
  errors: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        message: Schema.String,
      }),
    ),
  ),
  result: WorkersAiOutputSchema,
});

const WorkersAiResponseSchema = Schema.Struct({
  errors: WorkersAiEnvelopeSchema.fields.errors,
  response: WorkersAiOutputSchema.fields.response,
  result: Schema.optionalKey(WorkersAiOutputSchema),
  tool_calls: WorkersAiOutputSchema.fields.tool_calls,
  usage: WorkersAiOutputSchema.fields.usage,
});

type WorkersAiDecodedOutput = Schema.Schema.Type<typeof WorkersAiOutputSchema>;
type WorkersAiResponse = Schema.Schema.Type<typeof WorkersAiResponseSchema>;
const encodeJsonString = Schema.encodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

export function runWorkersAiOverRest(input: {
  readonly accountId: string;
  readonly apiKey: Redacted.Redacted<string>;
  readonly client: ProviderHttpClient;
  readonly model: string;
  readonly request: AiTextGenerationInput;
}): Effect.Effect<
  AiTextGenerationOutput,
  AssistantModelRequestError | AssistantModelResponseDecodeError
> {
  return postJsonResponse({
    bearerToken: input.apiKey,
    body: input.request,
    client: input.client,
    onResponse: readWorkersAiOutput,
    onStatusError: rejectWorkersAiRequest,
    provider: "Workers AI",
    url: `https://api.cloudflare.com/client/v4/accounts/${input.accountId}/ai/run/${encodeURIComponent(input.model)}`,
  });
}

function rejectWorkersAiRequest(
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<never, AssistantModelRequestError> {
  return Effect.gen(function* () {
    const rawBody = yield* readResponseText({
      provider: "Workers AI",
      response,
    });
    const status = response.status;
    const fallbackMessage = createProviderStatusMessage({
      provider: "Workers AI",
      rawBody,
      status,
    });
    const envelope = yield* decodeJsonTextEffect({
      provider: "Workers AI",
      rawBody,
      reportInput: true,
      schema: WorkersAiEnvelopeSchema,
    }).pipe(Effect.option);
    const message = envelope.pipe(
      Option.match({
        onNone: () => fallbackMessage,
        onSome: (payload) => {
          const errors = payload.errors ?? [];

          if (errors.length === 0) {
            return fallbackMessage;
          }

          return `Workers AI request failed with ${status}: ${errors
            .map((error) => error.message)
            .join(", ")}`;
        },
      }),
    );

    return yield* new AssistantModelRequestError({
      message,
      provider: "Workers AI",
      status,
    });
  });
}

function readWorkersAiOutput(
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<
  AiTextGenerationOutput,
  AssistantModelRequestError | AssistantModelResponseDecodeError
> {
  return decodeJsonResponseEffect({
    provider: "Workers AI",
    response,
    schema: WorkersAiResponseSchema,
  }).pipe(Effect.map(toAiTextGenerationOutput));
}

function toAiTextGenerationOutput(output: WorkersAiResponse): AiTextGenerationOutput {
  return toAiTextGenerationOutputFromDecoded(output.result ?? output);
}

function toAiTextGenerationOutputFromDecoded(
  output: WorkersAiDecodedOutput,
): AiTextGenerationOutput {
  const normalized: AiTextGenerationOutput = {};

  if (output.response !== undefined) {
    normalized.response = output.response;
  }

  if (output.tool_calls !== undefined) {
    normalized.tool_calls = output.tool_calls.map(toHybridToolCall);
  }

  if (output.usage !== undefined) {
    normalized.usage = output.usage;
  }

  return normalized;
}

function toHybridToolCall(
  toolCall: Schema.Schema.Type<typeof WorkersAiToolCallSchema>,
  index: number,
): AiTextGenerationToolLegacyOutput & AiTextGenerationToolOutput {
  return {
    arguments: toolCall.arguments,
    function: {
      arguments: encodeJsonString(toolCall.arguments),
      name: toolCall.name,
    },
    id: `legacy-${index}`,
    name: toolCall.name,
    type: "function",
  };
}

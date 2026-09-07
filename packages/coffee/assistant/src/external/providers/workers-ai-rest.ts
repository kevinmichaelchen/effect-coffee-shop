import * as Arr from "effect/Array";
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

const WorkersAiToolCall = Schema.Struct({
  arguments: Schema.Unknown,
  name: Schema.String,
});

const WorkersAiUsage = Schema.Struct({
  completion_tokens: Schema.Number,
  prompt_tokens: Schema.Number,
  total_tokens: Schema.Number,
});

const WorkersAiOutput = Schema.Struct({
  response: Schema.optionalKey(Schema.String),
  tool_calls: Schema.optionalKey(Schema.Array(WorkersAiToolCall)),
  usage: Schema.optionalKey(WorkersAiUsage),
});

const WorkersAiEnvelope = Schema.Struct({
  errors: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        message: Schema.String,
      }),
    ),
  ),
  result: WorkersAiOutput,
});

const WorkersAiResponse = Schema.Struct({
  errors: WorkersAiEnvelope.fields.errors,
  response: WorkersAiOutput.fields.response,
  result: Schema.optionalKey(WorkersAiOutput),
  tool_calls: WorkersAiOutput.fields.tool_calls,
  usage: WorkersAiOutput.fields.usage,
});

type WorkersAiDecodedOutput = Schema.Schema.Type<typeof WorkersAiOutput>;
type WorkersAiResponse = Schema.Schema.Type<typeof WorkersAiResponse>;
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
      schema: WorkersAiEnvelope,
    }).pipe(Effect.option);
    const message = envelope.pipe(
      Option.match({
        onNone: () => fallbackMessage,
        onSome: (payload) => {
          const errors = payload.errors ?? [];

          if (Arr.isReadonlyArrayEmpty(errors)) {
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
    schema: WorkersAiResponse,
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
  toolCall: Schema.Schema.Type<typeof WorkersAiToolCall>,
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

import type {
  AiTextGenerationInput,
  AiTextGenerationOutput,
  AiTextGenerationToolLegacyOutput,
  AiTextGenerationToolOutput,
} from "@cloudflare/workers-types";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { AssistantModelRequestError, AssistantModelResponseDecodeError } from "./model.ts";
import {
  createProviderStatusMessage,
  decodeJsonTextEffect,
  postJson,
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

type WorkersAiDecodedOutput = Schema.Schema.Type<typeof WorkersAiOutputSchema>;

export function runWorkersAiOverRest(input: {
  readonly accountId: string;
  readonly apiKey: string;
  readonly model: string;
  readonly request: AiTextGenerationInput;
}): Effect.Effect<
  AiTextGenerationOutput,
  AssistantModelRequestError | AssistantModelResponseDecodeError
> {
  return Effect.gen(function* () {
    const response = yield* postJson({
      body: input.request,
      headers: {
        authorization: `Bearer ${input.apiKey}`,
      },
      provider: "Workers AI",
      url: `https://api.cloudflare.com/client/v4/accounts/${input.accountId}/ai/run/${encodeURIComponent(input.model)}`,
    });

    if (!response.ok) {
      return yield* rejectWorkersAiRequest(response);
    }

    return yield* readWorkersAiOutput(response);
  });
}

function rejectWorkersAiRequest(
  response: Response,
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
  response: Response,
): Effect.Effect<
  AiTextGenerationOutput,
  AssistantModelRequestError | AssistantModelResponseDecodeError
> {
  return Effect.gen(function* () {
    const rawBody = yield* readResponseText({
      provider: "Workers AI",
      response,
    });

    return yield* decodeWorkersAiOutput(rawBody);
  });
}

function decodeWorkersAiOutput(
  rawBody: string,
): Effect.Effect<AiTextGenerationOutput, AssistantModelResponseDecodeError> {
  return decodeJsonTextEffect({
    provider: "Workers AI",
    rawBody,
    schema: WorkersAiEnvelopeSchema,
  }).pipe(
    Effect.matchEffect({
      onFailure: () =>
        decodeJsonTextEffect({
          provider: "Workers AI",
          rawBody,
          schema: WorkersAiOutputSchema,
        }).pipe(Effect.map(toAiTextGenerationOutput)),
      onSuccess: (envelope) => Effect.succeed(toAiTextGenerationOutput(envelope.result)),
    }),
  );
}

function toAiTextGenerationOutput(output: WorkersAiDecodedOutput): AiTextGenerationOutput {
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
      arguments: JSON.stringify(toolCall.arguments),
      name: toolCall.name,
    },
    id: `legacy-${index}`,
    name: toolCall.name,
    type: "function",
  };
}

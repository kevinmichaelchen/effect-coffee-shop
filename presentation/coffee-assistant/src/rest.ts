import type {
  AiTextGenerationInput,
  AiTextGenerationOutput,
  AiTextGenerationToolLegacyOutput,
  AiTextGenerationToolOutput,
} from "@cloudflare/workers-types";
import * as Schema from "effect/Schema";

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

class WorkersAiRequestError extends Schema.TaggedErrorClass<WorkersAiRequestError>()(
  "WorkersAiRequestError",
  {
    message: Schema.String,
    status: Schema.Number,
  },
) {}

class WorkersAiResponseDecodeError extends Schema.TaggedErrorClass<WorkersAiResponseDecodeError>()(
  "WorkersAiResponseDecodeError",
  {
    message: Schema.String,
  },
) {}

export async function runWorkersAiOverRest(input: {
  readonly accountId: string;
  readonly apiKey: string;
  readonly model: string;
  readonly request: AiTextGenerationInput;
}): Promise<AiTextGenerationOutput> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${input.accountId}/ai/run/${encodeURIComponent(input.model)}`,
    {
      body: JSON.stringify(input.request),
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    return rejectWorkersAiRequest(response);
  }

  return readWorkersAiOutput(response);
}

async function rejectWorkersAiRequest(response: Response): Promise<never> {
  const rawBody = await response.text();
  const status = response.status;
  const fallbackMessage =
    rawBody.trim() === ""
      ? `Workers AI request failed with ${status}.`
      : `Workers AI request failed with ${status}: ${rawBody}`;
  const message = await decodeJsonText(rawBody, WorkersAiEnvelopeSchema)
    .then((payload) => {
      const errors = payload.errors ?? [];

      if (errors.length === 0) {
        return fallbackMessage;
      }

      return `Workers AI request failed with ${status}: ${errors
        .map((error) => error.message)
        .join(", ")}`;
    })
    .catch(() => fallbackMessage);

  return Promise.reject(
    new WorkersAiRequestError({
      message,
      status,
    }),
  );
}

async function readWorkersAiOutput(response: Response): Promise<AiTextGenerationOutput> {
  const rawBody = await response.text();
  const output = await decodeWorkersAiOutput(rawBody)
    .then((value) => ({ success: true as const, value }))
    .catch(() => ({ success: false as const }));

  if (!output.success) {
    return Promise.reject(
      new WorkersAiResponseDecodeError({
        message: "Workers AI returned an unexpected response body.",
      }),
    );
  }

  return output.value;
}

async function decodeWorkersAiOutput(rawBody: string): Promise<AiTextGenerationOutput> {
  const envelope = await decodeJsonText(rawBody, WorkersAiEnvelopeSchema).catch(() => undefined);

  if (envelope !== undefined) {
    return toAiTextGenerationOutput(envelope.result);
  }

  const output = await decodeJsonText(rawBody, WorkersAiOutputSchema);
  return toAiTextGenerationOutput(output);
}

async function decodeJsonText<SchemaType extends Schema.Decoder<unknown>>(
  rawBody: string,
  schema: SchemaType,
): Promise<SchemaType["Type"]> {
  return Schema.decodeUnknownPromise(schema)(
    Schema.decodeUnknownSync(Schema.UnknownFromJsonString)(rawBody),
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

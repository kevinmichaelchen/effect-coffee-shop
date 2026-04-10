import type { AiTextGenerationInput, AiTextGenerationOutput } from "@cloudflare/workers-types";

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
  const rawBody = await response.text();
  const payload = parseJsonValue(rawBody);

  if (!response.ok) {
    throw new Error(readWorkersAiError(response.status, payload, rawBody));
  }

  return unwrapWorkersAiResult(payload);
}

function parseJsonValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function unwrapWorkersAiResult(payload: unknown): AiTextGenerationOutput {
  if (isWorkersAiEnvelope(payload)) {
    return payload.result;
  }

  if (isAiTextGenerationOutput(payload)) {
    return payload;
  }

  throw new Error("Workers AI returned an unexpected response body.");
}

function readWorkersAiError(status: number, payload: unknown, rawBody: string): string {
  if (isWorkersAiEnvelope(payload) && Array.isArray(payload.errors) && payload.errors.length > 0) {
    return `Workers AI request failed with ${status}: ${payload.errors
      .map((error) => error.message)
      .join(", ")}`;
  }

  return rawBody.trim() === ""
    ? `Workers AI request failed with ${status}.`
    : `Workers AI request failed with ${status}: ${rawBody}`;
}

function isWorkersAiEnvelope(value: unknown): value is {
  readonly errors?: ReadonlyArray<{ readonly message: string }>;
  readonly result: AiTextGenerationOutput;
} {
  return typeof value === "object" && value !== null && "result" in value;
}

function isAiTextGenerationOutput(value: unknown): value is AiTextGenerationOutput {
  return (
    typeof value === "object" && value !== null && ("response" in value || "tool_calls" in value)
  );
}

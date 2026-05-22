/**
 * Runs assistant requests against an Ollama-compatible chat API.
 *
 * @module
 */
import * as Schema from "effect/Schema";
import * as Effect from "effect/Effect";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import type {
  AssistantConversationMessage,
  AssistantModelRequest,
  AssistantModelResponse,
  AssistantModelRunnerService,
  AssistantToolCall,
  AssistantToolDefinition,
} from "../../application/model.ts";
import {
  AssistantModelRequestError,
  AssistantModelResponseDecodeError,
  extractResponseText,
  getAssistantToolDescription,
  getAssistantToolName,
} from "../../application/model.ts";
import {
  createProviderStatusMessage,
  decodeJsonTextEffect,
  postJsonResponse,
  readResponseText,
} from "./provider-http.ts";

export interface OllamaConfig {
  readonly endpoint: string;
  readonly kind: "ollama";
}

const OllamaToolCallSchema = Schema.Struct({
  function: Schema.Struct({
    arguments: Schema.Unknown,
    name: Schema.String,
  }),
});

const OllamaChatResponseSchema = Schema.Struct({
  message: Schema.Struct({
    content: Schema.optionalKey(Schema.String),
    tool_calls: Schema.optionalKey(Schema.Array(OllamaToolCallSchema)),
  }),
});

interface OllamaChatRequest {
  readonly messages: readonly OllamaMessage[];
  readonly model: string;
  readonly options: {
    readonly num_predict: number;
  };
  readonly stream: false;
  readonly tools: readonly OllamaTool[];
}

type OllamaMessage =
  | {
      readonly content: string;
      readonly role: "assistant" | "system" | "user";
      readonly tool_calls?: readonly OllamaToolCall[];
    }
  | {
      readonly content: string;
      readonly role: "tool";
      readonly tool_name: string;
    };

interface OllamaTool {
  readonly function: {
    readonly description: string;
    readonly name: string;
    readonly parameters: AssistantToolDefinition["parameters"];
  };
  readonly type: "function";
}

interface OllamaToolCall {
  readonly function: {
    readonly arguments: unknown;
    readonly name: string;
  };
}

export function makeOllamaRunner(config: OllamaConfig): AssistantModelRunnerService {
  const endpoint = normalizeEndpoint(config.endpoint);

  return {
    run: (request) => runOllamaChat(endpoint, request),
  };
}

function runOllamaChat(
  endpoint: string,
  request: AssistantModelRequest,
): Effect.Effect<
  AssistantModelResponse,
  AssistantModelRequestError | AssistantModelResponseDecodeError
> {
  return postJsonResponse({
    body: toOllamaChatRequest(request),
    onResponse: readOllamaResponse,
    onStatusError: rejectOllamaRequest,
    provider: "Ollama",
    url: `${endpoint}/api/chat`,
  });
}

function rejectOllamaRequest(
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<never, AssistantModelRequestError> {
  return Effect.gen(function* () {
    const rawBody = yield* readResponseText({
      provider: "Ollama",
      response,
    });
    const status = response.status;

    return yield* new AssistantModelRequestError({
      message: createProviderStatusMessage({
        provider: "Ollama",
        rawBody,
        status,
      }),
      provider: "Ollama",
      status,
    });
  });
}

function readOllamaResponse(
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<
  AssistantModelResponse,
  AssistantModelRequestError | AssistantModelResponseDecodeError
> {
  return Effect.gen(function* () {
    const rawBody = yield* readResponseText({
      provider: "Ollama",
      response,
    });
    const output = yield* decodeJsonTextEffect({
      provider: "Ollama",
      rawBody,
      schema: OllamaChatResponseSchema,
    });

    return {
      text: extractResponseText(output.message.content),
      toolCalls: output.message.tool_calls?.map(toAssistantToolCall) ?? [],
    };
  });
}

function toOllamaChatRequest(request: AssistantModelRequest): OllamaChatRequest {
  return {
    messages: request.conversation.map(toOllamaMessage),
    model: request.model,
    options: {
      num_predict: request.maxTokens,
    },
    stream: false,
    tools: request.tools.map(toOllamaTool),
  };
}

function toOllamaMessage(message: AssistantConversationMessage): OllamaMessage {
  if (message.role === "tool") {
    return {
      content: message.content,
      role: "tool",
      tool_name: message.name,
    };
  }

  if (message.toolCalls === undefined) {
    return {
      content: message.content,
      role: message.role,
    };
  }

  return {
    content: message.content,
    role: message.role,
    tool_calls: message.toolCalls.map(toOllamaToolCall),
  };
}

function toOllamaTool(tool: AssistantToolDefinition): OllamaTool {
  return {
    function: {
      description: getAssistantToolDescription(tool),
      name: getAssistantToolName(tool),
      parameters: tool.parameters,
    },
    type: "function",
  };
}

function toOllamaToolCall(toolCall: AssistantToolCall): OllamaToolCall {
  return {
    function: {
      arguments: toolCall.arguments,
      name: toolCall.name,
    },
  };
}

function toAssistantToolCall(
  toolCall: Schema.Schema.Type<typeof OllamaToolCallSchema>,
): AssistantToolCall {
  return {
    arguments: toolCall.function.arguments,
    name: toolCall.function.name,
  };
}

function normalizeEndpoint(endpoint: string): string {
  const trimmedEndpoint = endpoint.trim();

  if (trimmedEndpoint.startsWith("http://") || trimmedEndpoint.startsWith("https://")) {
    return trimTrailingSlash(trimmedEndpoint);
  }

  return trimTrailingSlash(`http://${trimmedEndpoint}`);
}

function trimTrailingSlash(endpoint: string): string {
  if (endpoint.endsWith("/")) {
    return trimTrailingSlash(endpoint.slice(0, -1));
  }

  return endpoint;
}

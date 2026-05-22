/**
 * Selects assistant model providers and runs multi-turn tool conversations.
 *
 * @module
 */
import type { ModelMessage } from "@tanstack/ai";
import { jsonString } from "@effect-coffee-shop/backend-host/json";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import {
  type AssistantConversationMessage,
  type AssistantModelError,
  type AssistantModelRunnerService,
  type AssistantRequestMetadata,
  type AssistantToolCall,
  type AssistantToolDefinition,
  AssistantModelRunner,
  getAssistantToolName,
  toAssistantConversationMessages,
} from "./model.ts";
import { type OllamaConfig, makeOllamaRunner } from "./ollama-runtime.ts";
import { type WorkersAiConfig, makeWorkersAiRunner } from "./workers-ai-runtime.ts";

export type { AssistantModelRunner, AssistantModelRunnerService } from "./model.ts";

const maxAssistantToolRounds = 4;
const assistantMaxTokens = 256;
const defaultOllamaEndpoint = "http://localhost:11434";
const assistantProviderOllama = "ollama";
const assistantProviderWorkersAi = "workers-ai";
const assistantProviderWorkersAiRest = "workers-ai-rest";
const assistantToolLoopExhaustedMessage =
  "I couldn't finish the request because the tool loop did not converge.";
const decodeTrimmedString = Schema.decodeUnknownSync(Schema.Trim);

export type AssistantAiConfig = OllamaConfig | WorkersAiConfig;

interface AssistantConversationRoundInput {
  readonly conversation: readonly AssistantConversationMessage[];
  readonly eventId: string | undefined;
  readonly model: string;
  readonly requestMetadata: AssistantRequestMetadata | undefined;
  readonly round: number;
  readonly tools: readonly AssistantToolDefinition[];
}

export function getAssistantAiConfigFromEnv(
  env: Record<string, string | undefined>,
): AssistantAiConfig | undefined {
  const provider = readOptionalEnv(env.COFFEE_ASSISTANT_PROVIDER);
  const ollamaEndpoint =
    readOptionalEnv(env.COFFEE_ASSISTANT_OLLAMA_URL) ?? readOptionalEnv(env.OLLAMA_HOST);
  const accountId = readOptionalEnv(env.CLOUDFLARE_ACCOUNT_ID);
  const apiKey = readOptionalEnv(env.CLOUDFLARE_API_TOKEN);
  const workersAiRestConfig = getWorkersAiRestConfig({
    accountId,
    apiKey,
  });
  const explicitProviderConfig: Option.Option<Option.Option<AssistantAiConfig>> = Match.value(
    provider,
  ).pipe(
    Match.when(
      assistantProviderOllama,
      (): Option.Option<Option.Option<OllamaConfig>> =>
        Option.some(
          Option.some({
            kind: "ollama",
            endpoint: ollamaEndpoint ?? defaultOllamaEndpoint,
          }),
        ),
    ),
    Match.when(assistantProviderWorkersAi, () => Option.some(workersAiRestConfig)),
    Match.when(assistantProviderWorkersAiRest, () => Option.some(workersAiRestConfig)),
    Match.orElse(() => Option.none()),
  );
  const ambientOllamaConfig: Option.Option<OllamaConfig> = Option.map(
    Option.fromUndefinedOr(ollamaEndpoint),
    (endpoint) => ({
      kind: "ollama",
      endpoint,
    }),
  );

  return explicitProviderConfig.pipe(
    Option.match({
      onNone: () =>
        Option.getOrUndefined(Option.firstSomeOf([workersAiRestConfig, ambientOllamaConfig])),
      onSome: Option.getOrUndefined,
    }),
  );
}

export const getBunAssistantAiConfig = getAssistantAiConfigFromEnv;

export function getAssistantModel(
  env?: Record<string, string | undefined>,
  ai?: AssistantAiConfig,
): string | undefined {
  return Option.match(Option.fromUndefinedOr(readOptionalEnv(env?.COFFEE_ASSISTANT_MODEL)), {
    onNone: () =>
      Match.value(ai?.kind).pipe(
        Match.when("ollama", () => undefined),
        Match.orElse(() => getDefaultWorkersAiModel()),
      ),
    onSome: (model) => model,
  });
}

function getDefaultWorkersAiModel(): string {
  return "@cf/meta/llama-3.1-8b-instruct-fast";
}

function readOptionalEnv(value: string | undefined): string | undefined {
  return Option.some(decodeTrimmedString(value ?? "")).pipe(
    Option.filter((trimmedValue) => trimmedValue !== ""),
    Option.getOrUndefined,
  );
}

function getWorkersAiRestConfig(input: {
  readonly accountId: string | undefined;
  readonly apiKey: string | undefined;
}): Option.Option<WorkersAiConfig> {
  return Option.all({
    accountId: Option.fromUndefinedOr(input.accountId),
    apiKey: Option.fromUndefinedOr(input.apiKey),
  }).pipe(
    Option.map(({ accountId, apiKey }) => ({
      kind: "workers-ai-rest",
      accountId,
      apiKey: Redacted.make(apiKey, { label: "CLOUDFLARE_API_TOKEN" }),
    })),
  );
}

export function createAssistantModelRunner(config: AssistantAiConfig): AssistantModelRunnerService {
  return Match.value(config).pipe(
    Match.when({ kind: "ollama" }, makeOllamaRunner),
    Match.orElse(makeWorkersAiRunner),
  );
}

export function createAssistantModelRunnerLayer(
  config: AssistantAiConfig,
): Layer.Layer<AssistantModelRunner> {
  return Layer.succeed(AssistantModelRunner)(createAssistantModelRunner(config));
}

export function runAssistantConversation(input: {
  readonly eventId?: string;
  readonly messages: readonly ModelMessage[];
  readonly model: string;
  readonly requestMetadata?: AssistantRequestMetadata;
  readonly systemPrompt: string;
  readonly tools: readonly AssistantToolDefinition[];
}): Effect.Effect<string, AssistantModelError, AssistantModelRunner> {
  const conversation = toAssistantConversationMessages(input.messages, input.systemPrompt);

  return runAssistantConversationRound({
    conversation,
    eventId: input.eventId,
    model: input.model,
    requestMetadata: input.requestMetadata,
    round: 0,
    tools: input.tools,
  });
}

function runAssistantConversationRound(
  input: AssistantConversationRoundInput,
): Effect.Effect<string, AssistantModelError, AssistantModelRunner> {
  return Effect.gen(function* () {
    const runner = yield* AssistantModelRunner;

    return yield* runner
      .run({
        conversation: input.conversation,
        eventId: input.eventId,
        maxTokens: assistantMaxTokens,
        model: input.model,
        requestMetadata: input.requestMetadata,
        tools: input.tools,
      })
      .pipe(
        Effect.flatMap((response) => {
          if (response.toolCalls.length === 0) {
            return Effect.succeed(response.text);
          }

          if (input.round === maxAssistantToolRounds) {
            return Effect.succeed(assistantToolLoopExhaustedMessage);
          }

          return appendToolCallMessages(input.conversation, response.toolCalls, input.tools).pipe(
            Effect.flatMap((conversation) =>
              runAssistantConversationRound({
                conversation,
                eventId: input.eventId,
                model: input.model,
                requestMetadata: input.requestMetadata,
                round: input.round + 1,
                tools: input.tools,
              }),
            ),
          );
        }),
      );
  });
}

function appendToolCallMessages(
  conversation: readonly AssistantConversationMessage[],
  toolCalls: readonly AssistantToolCall[],
  tools: readonly AssistantToolDefinition[],
): Effect.Effect<readonly AssistantConversationMessage[]> {
  return Effect.forEach(
    toolCalls,
    (toolCall) =>
      executeToolCall(toolCall, tools).pipe(
        Effect.map((content): readonly AssistantConversationMessage[] => [
          {
            role: "assistant",
            content: jsonString(toolCall),
            toolCalls: [toolCall],
          },
          {
            content,
            name: toolCall.name,
            role: "tool",
          },
        ]),
      ),
    { concurrency: 1 },
  ).pipe(Effect.map((messages) => conversation.concat(messages.flat())));
}

function executeToolCall(
  toolCall: AssistantToolCall,
  tools: readonly AssistantToolDefinition[],
): Effect.Effect<string> {
  const selectedTool = tools.find((tool) => getAssistantToolName(tool) === toolCall.name);

  if (!selectedTool) {
    return Effect.succeed(`Unknown tool requested: ${toolCall.name}`);
  }

  return selectedTool.execute(toolCall.arguments);
}

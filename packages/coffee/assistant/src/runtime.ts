import type { ModelMessage } from "@tanstack/ai";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
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
const assistantToolLoopExhaustedMessage =
  "I couldn't finish the request because the tool loop did not converge.";
const decodeTrimmedString = Schema.decodeUnknownSync(Schema.Trim);
const ReceiptOrderItemSchema = Schema.Struct({
  drinkName: Schema.String,
  milk: Schema.String,
  notes: Schema.optionalKey(Schema.String),
  quantity: Schema.Int,
  shots: Schema.Int,
  size: Schema.String,
  temperature: Schema.String,
});
type ReceiptOrderItem = typeof ReceiptOrderItemSchema.Type;
const ReceiptOrderSchema = Schema.Struct({
  id: Schema.String,
  items: Schema.NonEmptyArray(ReceiptOrderItemSchema),
  totalPriceCents: Schema.Int,
});
type ReceiptOrder = typeof ReceiptOrderSchema.Type;
const decodeJsonString = Schema.decodeUnknownOption(Schema.UnknownFromJsonString);
const decodeReceiptOrder = Schema.decodeUnknownOption(ReceiptOrderSchema);

export type AssistantAiConfig = OllamaConfig | WorkersAiConfig;

interface AssistantConversationRoundInput {
  readonly conversation: readonly AssistantConversationMessage[];
  readonly eventId: string | undefined;
  readonly model: string;
  readonly requestMetadata: AssistantRequestMetadata | undefined;
  readonly round: number;
  readonly tools: readonly AssistantToolDefinition[];
}

interface ExecutedToolMessages {
  readonly messages: readonly AssistantConversationMessage[];
  readonly receipt: Option.Option<string>;
}

export function getBunAssistantAiConfig(
  env: Record<string, string | undefined>,
): AssistantAiConfig | undefined {
  const provider = readOptionalEnv(env.COFFEE_ASSISTANT_PROVIDER);
  const ollamaEndpoint =
    readOptionalEnv(env.COFFEE_ASSISTANT_OLLAMA_URL) ?? readOptionalEnv(env.OLLAMA_HOST);

  if (provider === "ollama" || ollamaEndpoint !== undefined) {
    return {
      kind: "ollama",
      endpoint: ollamaEndpoint ?? defaultOllamaEndpoint,
    };
  }

  const accountId = readOptionalEnv(env.CLOUDFLARE_ACCOUNT_ID);
  const apiKey = readOptionalEnv(env.CLOUDFLARE_API_TOKEN);

  if (!accountId || !apiKey) {
    return undefined;
  }

  return {
    kind: "workers-ai-rest",
    accountId,
    apiKey,
  };
}

export function getAssistantModel(
  env?: Record<string, string | undefined>,
  ai?: AssistantAiConfig,
): string | undefined {
  const model = readOptionalEnv(env?.COFFEE_ASSISTANT_MODEL);

  if (model) {
    return model;
  }

  if (ai?.kind === "ollama") {
    return undefined;
  }

  return getDefaultWorkersAiModel();
}

function getDefaultWorkersAiModel(): string {
  return "@cf/meta/llama-3.1-8b-instruct-fast";
}

function readOptionalEnv(value: string | undefined): string | undefined {
  const trimmedValue = decodeTrimmedString(value ?? "");

  if (!trimmedValue) {
    return undefined;
  }

  return trimmedValue;
}

export function createAssistantModelRunner(config: AssistantAiConfig): AssistantModelRunnerService {
  if (config.kind === "ollama") {
    return makeOllamaRunner(config);
  }

  return makeWorkersAiRunner(config);
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
            Effect.flatMap((appendResult) =>
              Option.match(appendResult.receipt, {
                onNone: () =>
                  runAssistantConversationRound({
                    conversation: appendResult.conversation,
                    eventId: input.eventId,
                    model: input.model,
                    requestMetadata: input.requestMetadata,
                    round: input.round + 1,
                    tools: input.tools,
                  }),
                onSome: (receipt) => Effect.succeed(receipt),
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
) {
  return Effect.forEach(toolCalls, (toolCall) =>
    executeToolCall(toolCall, tools).pipe(
      Effect.map(
        (content): ExecutedToolMessages => ({
          messages: [
            {
              role: "assistant",
              content: JSON.stringify(toolCall),
              toolCalls: [toolCall],
            },
            {
              content,
              name: toolCall.name,
              role: "tool",
            },
          ],
          receipt: receiptFromPurchaseToolResult(toolCall.name, content),
        }),
      ),
    ),
  ).pipe(
    Effect.map((executedMessages) => ({
      conversation: conversation.concat(executedMessages.flatMap((result) => result.messages)),
      receipt: lastReceipt(executedMessages),
    })),
  );
}

function executeToolCall(toolCall: AssistantToolCall, tools: readonly AssistantToolDefinition[]) {
  const selectedTool = tools.find((tool) => getAssistantToolName(tool) === toolCall.name);

  if (!selectedTool) {
    return Effect.succeed(`Unknown tool requested: ${toolCall.name}`);
  }

  return selectedTool.execute(toolCall.arguments);
}

function receiptFromPurchaseToolResult(toolName: string, content: string): Option.Option<string> {
  return Option.flatMap(Option.liftPredicate(toolName, purchaseToolName), () =>
    receiptFromToolResultContent(content),
  );
}

function purchaseToolName(toolName: string): boolean {
  return toolName === "place_order" || toolName === "checkout_cart";
}

function receiptFromToolResultContent(content: string): Option.Option<string> {
  return Option.map(
    Option.flatMap(decodeJsonString(content), decodeReceiptOrder),
    receiptFromOrder,
  );
}

function lastReceipt(results: readonly ExecutedToolMessages[]): Option.Option<string> {
  const receipts = results.flatMap((result) =>
    Option.match(result.receipt, {
      onNone: () => [],
      onSome: (receipt) => [receipt],
    }),
  );

  return Option.fromNullishOr(receipts.at(-1));
}

function receiptFromOrder(order: ReceiptOrder): string {
  const drinkSummary = order.items.map(receiptItemSummary).join(", ");

  return `${drinkSummary}. Order ${order.id}. Total ${formatCents(order.totalPriceCents)}.`;
}

function receiptItemSummary(item: ReceiptOrderItem): string {
  const quantity = textWhen(`${item.quantity} x `, item.quantity !== 1);
  const milk = textWhen(`${item.milk} milk `, item.milk !== "none");
  const shots = textWhen(` ${item.shots} shots`, item.shots !== 1);
  const noteText = item.notes ?? "";
  const notes = textWhen(` (${noteText})`, noteText !== "");

  return `${quantity}${item.size} ${item.temperature} ${milk}${item.drinkName}${shots}${notes}`;
}

function textWhen(text: string, include: boolean): string {
  return Option.getOrElse(
    Option.liftPredicate(text, () => include),
    () => "",
  );
}

function formatCents(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const minorUnits = String(cents % 100).padStart(2, "0");

  return `$${dollars}.${minorUnits}`;
}

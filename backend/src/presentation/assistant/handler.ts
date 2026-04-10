import { toServerSentEventsResponse, type ModelMessage } from "@tanstack/ai";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";
import {
  type AssistantChunkQueue,
  type AssistantStreamChunk,
  createAssistantChunkQueue,
  createAssistantCustomChunk,
  createAssistantRunFinishedChunk,
  createAssistantRunStartedChunk,
  createAssistantStreamId,
  createAssistantTextContentChunk,
  createAssistantTextEndChunk,
  createAssistantTextStartChunk,
} from "./chunks.ts";
import {
  type AssistantAiConfig,
  getAssistantModel,
  getBunAssistantAiConfig,
  runAssistantConversation,
} from "./runtime.ts";
import { createCoffeeAssistantTools, getAssistantToolActivityEvent } from "./tools.ts";

const coffeeAssistantSystemPrompt = [
  "You are Beanline, the live assistant for the Onion Coffee Shop.",
  "Use the available coffee tools whenever the user asks about the menu, order status, queue state, or order actions.",
  "Never invent live menu data or order state when a matching tool exists.",
  "When a user asks to place or change an order, call the matching tool instead of describing what you would do.",
  "Keep answers tight. Usually respond in under 120 words.",
  "Explain outcomes in clear plain English with short paragraphs and no markdown tables.",
  "If a tool fails, explain the concrete failure and what the user can do next.",
].join(" ");

interface AssistantHandlerOptions {
  readonly ai: AssistantAiConfig | undefined;
  readonly appLayer: Layer.Layer<never, any, any>;
  readonly model?: string;
}

const AssistantContentTextPartSchema = Schema.Struct({
  type: Schema.Literal("text"),
  content: Schema.String,
});

const AssistantThinkingPartSchema = Schema.Struct({
  type: Schema.Literal("thinking"),
  content: Schema.String,
});

const AssistantModelMessageSchema = Schema.Struct({
  role: Schema.Literals(["user", "assistant", "tool"] as const),
  content: Schema.Union([Schema.String, Schema.Null, Schema.Array(AssistantContentTextPartSchema)]),
});

const AssistantUiMessageSchema = Schema.Struct({
  id: Schema.String,
  role: Schema.Literals(["system", "user", "assistant"] as const),
  parts: Schema.Array(Schema.Union([AssistantContentTextPartSchema, AssistantThinkingPartSchema])),
});

const AssistantRequestBodySchema = Schema.Struct({
  messages: Schema.Array(Schema.Union([AssistantModelMessageSchema, AssistantUiMessageSchema])),
});

type AssistantModelMessageInput = typeof AssistantModelMessageSchema.Type;
type AssistantRequestBody = typeof AssistantRequestBodySchema.Type;
type AssistantRequestMessage = (typeof AssistantRequestBodySchema.Type.messages)[number];
type AssistantUiMessageInput = typeof AssistantUiMessageSchema.Type;

const decodeAssistantRequestBody = Schema.decodeUnknownPromise(AssistantRequestBodySchema);
const isAssistantUiMessage = Schema.is(AssistantUiMessageSchema);

export async function handleAssistantRequest(
  request: Request,
  options: AssistantHandlerOptions,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (options.ai === undefined) {
    return unavailableResponse();
  }

  const body = await parseAssistantRequestBody(request);

  if (body === null) {
    return new Response("Invalid assistant request body.", { status: 400 });
  }

  const abortController = connectAbortSignal(request.signal);
  const queue = createAssistantChunkQueue<AssistantStreamChunk>(abortController.signal);

  void streamAssistantResponse({
    ai: options.ai,
    appLayer: options.appLayer,
    body,
    model: options.model ?? getAssistantModel(),
    queue,
  }).catch((error) => queue.fail(error));

  return toServerSentEventsResponse(queue.stream, {
    abortController,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export { getAssistantModel, getBunAssistantAiConfig };

type CoffeeAppRunner = <A, E>(effect: Effect.Effect<A, E, CoffeeOrderApp>) => Promise<A>;

async function streamAssistantResponse(input: {
  readonly ai: AssistantAiConfig;
  readonly appLayer: Layer.Layer<never, any, any>;
  readonly body: AssistantRequestBody;
  readonly model: string;
  readonly queue: AssistantChunkQueue<AssistantStreamChunk>;
}): Promise<void> {
  const messageId = createAssistantStreamId("msg");
  const runId = createAssistantStreamId("chat");
  const runApp = createCoffeeAppRunner(input.appLayer);

  input.queue.push(createAssistantRunStartedChunk(runId, input.model));

  const response = await runAssistantConversation({
    ai: input.ai,
    messages: toAssistantModelMessages(input.body.messages),
    model: input.model,
    systemPrompt: coffeeAssistantSystemPrompt,
    tools: createCoffeeAssistantTools(runApp, (activity) =>
      input.queue.push(
        createAssistantCustomChunk(input.model, getAssistantToolActivityEvent(), activity),
      ),
    ),
  });

  input.queue.push(createAssistantTextStartChunk(messageId, input.model));
  input.queue.push(createAssistantTextContentChunk(messageId, input.model, response));
  input.queue.push(createAssistantTextEndChunk(messageId, input.model));
  input.queue.push(createAssistantRunFinishedChunk(runId, input.model));
  input.queue.close();
}

function createCoffeeAppRunner<TAppLayer extends Layer.Layer<never, any, any>>(
  appLayer: TAppLayer,
): CoffeeAppRunner {
  const liveLayer = CoffeeOrderApp.layer.pipe(Layer.provide(appLayer));

  return async <A, E>(effect: Effect.Effect<A, E, CoffeeOrderApp>) =>
    Effect.runPromise(effect.pipe(Effect.provide(liveLayer)) as Effect.Effect<A, E, never>);
}

async function parseAssistantRequestBody(request: Request): Promise<AssistantRequestBody | null> {
  return request
    .json()
    .then(decodeAssistantRequestBody)
    .catch(() => null);
}

function toAssistantModelMessages(
  messages: readonly AssistantRequestMessage[],
): readonly ModelMessage[] {
  return messages.flatMap((message) =>
    isAssistantUiMessage(message)
      ? toAssistantModelMessagesFromUiMessage(message)
      : [toAssistantModelMessage(message)],
  );
}

function toAssistantModelMessage(message: AssistantModelMessageInput): ModelMessage {
  if (typeof message.content === "string" || message.content === null) {
    return {
      role: message.role,
      content: message.content,
    };
  }

  return {
    role: message.role,
    content: message.content.map((part) => ({
      type: part.type,
      content: part.content,
    })),
  };
}

function toAssistantModelMessagesFromUiMessage(
  message: AssistantUiMessageInput,
): readonly ModelMessage[] {
  if (message.role === "system") {
    return [];
  }

  const content = message.parts
    .map((part) => part.content)
    .join("")
    .trim();

  if (content === "") {
    return [];
  }

  return [
    {
      role: message.role,
      content,
    } satisfies AssistantModelMessageInput,
  ];
}

function connectAbortSignal(signal: AbortSignal): AbortController {
  const abortController = new AbortController();
  signal.addEventListener("abort", () => abortController.abort(), { once: true });
  return abortController;
}

function unavailableResponse(): Response {
  return new Response(
    "Workers AI is unavailable. Configure the Cloudflare AI binding or set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN for local Bun runs.",
    {
      status: 503,
    },
  );
}

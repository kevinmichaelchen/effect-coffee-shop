import { toServerSentEventsResponse } from "@tanstack/ai";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { emptyWebHandlerServices } from "#presentation/http/web-handler";
import { CoffeeOrderApp } from "@effect-coffee-shop/core/service/CoffeeOrderApp";
import { CurrentActor, type AppActor } from "@effect-coffee-shop/core/service/CurrentActor";
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
  type AssistantRequestBody,
  parseAssistantRequestBody,
  toAssistantModelMessages,
} from "./messages.ts";
import {
  createAssistantGatewayMetadata,
  logAssistantRunCompleted,
  logAssistantRunFailed,
  logAssistantRunStarted,
  logAssistantToolActivity,
} from "./observability.ts";
import {
  type AssistantAiConfig,
  getAssistantModel,
  getBunAssistantAiConfig,
  runAssistantConversation,
} from "./runtime.ts";
import { createCoffeeAssistantTools, getAssistantToolActivityEvent } from "./tools.ts";

const coffeeAssistantSystemPrompt = [
  "You are Beanline, the live assistant for the Effect Coffee Shop.",
  "Use the available coffee tools whenever the user asks about the menu, order status, queue state, or order actions.",
  "Never invent live menu data or order state when a matching tool exists.",
  "When a user asks to place or change an order, call the matching tool instead of describing what you would do.",
  "Keep answers tight. Usually respond in under 120 words.",
  "Explain outcomes in clear plain English with short paragraphs and no markdown tables.",
  "If a tool fails, explain the concrete failure and what the user can do next.",
].join(" ");

interface AssistantHandlerOptions {
  readonly actor: AppActor;
  readonly ai: AssistantAiConfig | undefined;
  readonly appLayer: Layer.Layer<never, any, any>;
  readonly model?: string;
}
type AssistantToolActivityRecordInput = {
  readonly detail: string;
  readonly kind: "tool-call" | "tool-result";
  readonly label: string;
};

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
    actor: options.actor,
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
  readonly actor: AppActor;
  readonly ai: AssistantAiConfig;
  readonly appLayer: Layer.Layer<never, any, any>;
  readonly body: AssistantRequestBody;
  readonly model: string;
  readonly queue: AssistantChunkQueue<AssistantStreamChunk>;
}): Promise<void> {
  const messageId = createAssistantStreamId("msg");
  const runId = createAssistantStreamId("chat");
  const runApp = createCoffeeAppRunner(input.appLayer, input.actor);
  const startedAt = performance.now();
  let toolCallCount = 0;
  const emitActivity = (activity: AssistantToolActivityRecordInput) => {
    if (activity.kind === "tool-call") {
      toolCallCount += 1;
    }

    logAssistantToolActivity({
      activity,
      actor: input.actor,
      model: input.model,
      runId,
    });
    input.queue.push(
      createAssistantCustomChunk(input.model, getAssistantToolActivityEvent(), activity),
    );
  };

  input.queue.push(createAssistantRunStartedChunk(runId, input.model));
  logAssistantRunStarted({
    actor: input.actor,
    gatewayEnabled: input.ai.kind === "binding" && input.ai.gatewayId !== undefined,
    model: input.model,
    runId,
  });

  try {
    const response = await runAssistantConversation({
      ai: input.ai,
      gatewayEventId: runId,
      gatewayMetadata: createAssistantGatewayMetadata(input.actor, runId),
      messages: toAssistantModelMessages(input.body.messages),
      model: input.model,
      systemPrompt: coffeeAssistantSystemPrompt,
      tools: createCoffeeAssistantTools(runApp, emitActivity),
    });

    input.queue.push(createAssistantTextStartChunk(messageId, input.model));
    input.queue.push(createAssistantTextContentChunk(messageId, input.model, response));
    input.queue.push(createAssistantTextEndChunk(messageId, input.model));
    input.queue.push(createAssistantRunFinishedChunk(runId, input.model));
    input.queue.close();

    logAssistantRunCompleted({
      actor: input.actor,
      durationMs: performance.now() - startedAt,
      model: input.model,
      runId,
      toolCallCount,
    });
  } catch (error) {
    logAssistantRunFailed({
      actor: input.actor,
      durationMs: performance.now() - startedAt,
      error,
      model: input.model,
      runId,
    });
    throw error;
  }
}

function createCoffeeAppRunner<TAppLayer extends Layer.Layer<never, any, any>>(
  appLayer: TAppLayer,
  actor: AppActor,
): CoffeeAppRunner {
  const liveLayer = CoffeeOrderApp.layer.pipe(Layer.provide(appLayer));
  const services = emptyWebHandlerServices().pipe(Context.add(CurrentActor, actor));

  return async <A, E>(effect: Effect.Effect<A, E, CoffeeOrderApp>) =>
    Effect.runPromiseWith(services)(effect.pipe(Effect.provide(liveLayer)));
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

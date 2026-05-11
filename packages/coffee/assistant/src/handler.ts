import { toServerSentEventsResponse } from "@tanstack/ai";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { emptyWebHandlerServices } from "@effect-coffee-shop/backend-host/request-services";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import {
  CurrentActor,
  type AppActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
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
  type AssistantModelRunner,
  createAssistantModelRunnerLayer,
  getAssistantModel,
  getBunAssistantAiConfig,
  runAssistantConversation,
} from "./runtime.ts";
import { createCoffeeAssistantTools, getAssistantToolActivityEvent } from "./tools/definitions.ts";

const coffeeAssistantSystemPrompt = [
  "You are Beanline, the live assistant for the Effect Coffee Shop.",
  "Use the available coffee tools whenever the user asks about the menu, order status, queue state, or order actions.",
  "Never invent live menu data or order state when a matching tool exists.",
  "Use the smallest useful tool path.",
  "When a user asks to place or change an order, call the matching tool instead of describing what you would do.",
  "For a complete one-shot order, call place_order directly. Do not call list_menu or get_item_options first unless the user asks about menu/options or the order is uncertain.",
  "Use list_menu for general menu, substitution, unavailable ingredient, or recommendation questions.",
  "Use get_item_options for a specific drink's defaults and valid choices when the user asks or a drink option is unclear.",
  "Use validate_order or quote_order only when options, price, or defaults are uncertain.",
  "Use cart tools for multi-item cart workflows, then checkout_cart.",
  "Safe defaults are allowed: medium size when size is missing, whole milk for milk-capable drinks, none for no-milk drinks, the drink's default temperature, one espresso shot, zero tea shots, and quantity one.",
  "Ask one short clarifying question when the drink, customer name, or another order-critical field is missing.",
  "After place_order or checkout_cart succeeds, stop using tools and give one concise confirmation with drink summary, order id, and exact $x.xx total.",
  "Keep answers tight. Usually respond in under 120 words.",
  "Explain outcomes in clear plain English with short paragraphs and no markdown tables.",
  "If a tool fails, explain the concrete failure and what the user can do next.",
].join(" ");

interface AssistantHandlerOptions {
  readonly actor: AppActor;
  readonly appLayer: Layer.Layer<never, any, any>;
  readonly gatewayEnabled?: boolean;
  readonly model: string | undefined;
  readonly modelLayer: Layer.Layer<AssistantModelRunner> | undefined;
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

  if (options.modelLayer === undefined) {
    return unavailableResponse("Configure a Beanline AI provider before using the assistant.");
  }

  if (options.model === undefined) {
    return unavailableResponse("Set COFFEE_ASSISTANT_MODEL for the selected Beanline AI provider.");
  }

  const body = await parseAssistantRequestBody(request);

  if (body === null) {
    return new Response("Invalid assistant request body.", { status: 400 });
  }

  const abortController = connectAbortSignal(request.signal);
  const queue = createAssistantChunkQueue<AssistantStreamChunk>(abortController.signal);

  void streamAssistantResponse({
    actor: options.actor,
    appLayer: options.appLayer,
    body,
    gatewayEnabled: options.gatewayEnabled ?? false,
    model: options.model,
    modelLayer: options.modelLayer,
    queue,
  }).catch((error) => queue.fail(error));

  return toServerSentEventsResponse(queue.stream, {
    abortController,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export { createAssistantModelRunnerLayer, getAssistantModel, getBunAssistantAiConfig };

type CoffeeAppRunner = <A, E>(effect: Effect.Effect<A, E, CoffeeOrderApp>) => Promise<A>;

async function streamAssistantResponse(input: {
  readonly actor: AppActor;
  readonly appLayer: Layer.Layer<never, any, any>;
  readonly body: AssistantRequestBody;
  readonly gatewayEnabled: boolean;
  readonly model: string;
  readonly modelLayer: Layer.Layer<AssistantModelRunner>;
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
    gatewayEnabled: input.gatewayEnabled,
    model: input.model,
    runId,
  });

  try {
    const response = await Effect.runPromise(
      runAssistantConversation({
        eventId: runId,
        messages: toAssistantModelMessages(input.body.messages),
        model: input.model,
        requestMetadata: createAssistantGatewayMetadata(input.actor, runId),
        systemPrompt: coffeeAssistantSystemPrompt,
        tools: createCoffeeAssistantTools(runApp, emitActivity),
      }).pipe(Effect.provide(input.modelLayer)),
    );

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

function unavailableResponse(message: string): Response {
  return new Response(message, {
    status: 503,
  });
}

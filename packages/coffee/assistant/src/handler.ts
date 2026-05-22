/**
 * Handles Beanline assistant HTTP requests and streams model responses.
 *
 * @module
 */
import { toServerSentEventsResponse } from "@tanstack/ai";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import {
  HostObservabilityLive,
  runHostEffect,
} from "@effect-coffee-shop/backend-host/observability";
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
  getAssistantAiConfigFromEnv,
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
  "Because orders spend real money, read back the interpreted order and ask for confirmation before purchase.",
  "On an initial order request, do not call place_order or checkout_cart yet; use cart tools followed by prepare_cart_checkout for cart workflows, or quote_order only when you are not ready to create a checkout session.",
  'Call place_order or checkout_cart only after the user explicitly confirms the final order, such as "yes, place it" or "submit that order".',
  "When the user confirms in a later turn, call get_checkout_session first and pass that checkoutSessionId to checkout_cart instead of guessing from chat text.",
  "Use list_menu for general menu, substitution, unavailable ingredient, or recommendation questions.",
  "Use get_item_options for a specific drink's defaults and valid choices when the user asks or a drink option is unclear.",
  "Use validate_order or quote_order only when options, price, or defaults are uncertain.",
  "Use cart tools for multi-item cart workflows, then prepare_cart_checkout, then checkout_cart after explicit confirmation.",
  "Safe defaults are allowed: medium size when size is missing, whole milk for milk-capable drinks, none for no-milk drinks, the drink's default temperature, one espresso shot, zero tea shots, and quantity one.",
  "Ask one short clarifying question when the drink, customer name, or another order-critical field is missing.",
  'Pre-purchase confirmation template: "I have <drink summary> for <name>, total $x.xx. Should I place it?"',
  "After place_order or checkout_cart succeeds, stop using tools and give one concise receipt: drink summary, order id, exact total.",
  "For the total, use the tool's dollar string when present or convert cents to dollars exactly: 520 cents becomes $5.20. Never use another currency, never print raw cents, and never write $520 for 520 cents.",
  'Receipt template: "<drink summary>. Order <id>. Total $x.xx."',
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

export {
  getAssistantAiConfigFromEnv,
  createAssistantModelRunnerLayer,
  getAssistantModel,
  getBunAssistantAiConfig,
};

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

    void runHostEffect(
      logAssistantToolActivity({
        activity,
        actor: input.actor,
        model: input.model,
        runId,
      }),
    );
    input.queue.push(
      createAssistantCustomChunk(input.model, getAssistantToolActivityEvent(), activity),
    );
  };

  input.queue.push(createAssistantRunStartedChunk(runId, input.model));
  void runHostEffect(
    logAssistantRunStarted({
      actor: input.actor,
      gatewayEnabled: input.gatewayEnabled,
      model: input.model,
      runId,
    }),
  );

  try {
    const response = await Effect.runPromise(
      runAssistantConversation({
        eventId: runId,
        messages: toAssistantModelMessages(input.body.messages),
        model: input.model,
        requestMetadata: createAssistantGatewayMetadata(input.actor, runId),
        systemPrompt: coffeeAssistantSystemPrompt,
        tools: createCoffeeAssistantTools(runApp, emitActivity),
      }).pipe(
        Effect.withSpan("assistant.run"),
        Effect.annotateSpans({
          actor_kind: input.actor.kind,
          assistant_gateway_enabled: input.gatewayEnabled,
          assistant_model: input.model,
          assistant_run_id: runId,
        }),
        Effect.provide(input.modelLayer),
        Effect.provide(HostObservabilityLive),
      ),
    );

    input.queue.push(createAssistantTextStartChunk(messageId, input.model));
    input.queue.push(createAssistantTextContentChunk(messageId, input.model, response));
    input.queue.push(createAssistantTextEndChunk(messageId, input.model));
    input.queue.push(createAssistantRunFinishedChunk(runId, input.model));
    input.queue.close();

    await runHostEffect(
      logAssistantRunCompleted({
        actor: input.actor,
        durationMs: performance.now() - startedAt,
        gatewayEnabled: input.gatewayEnabled,
        model: input.model,
        runId,
        toolCallCount,
      }),
    );
  } catch (error) {
    await runHostEffect(
      logAssistantRunFailed({
        actor: input.actor,
        durationMs: performance.now() - startedAt,
        error,
        gatewayEnabled: input.gatewayEnabled,
        model: input.model,
        runId,
      }),
    );
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
    Effect.runPromiseWith(services)(
      effect.pipe(Effect.provide(liveLayer), Effect.provide(HostObservabilityLive)),
    );
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

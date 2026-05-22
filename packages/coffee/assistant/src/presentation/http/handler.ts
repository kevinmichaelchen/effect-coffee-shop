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
import { type AssistantModelRunner } from "../../application/model.ts";
import { runAssistantConversation } from "../../application/runtime.ts";
import { coffeeAssistantSystemPrompt } from "../../application/system-prompt.ts";
import {
  createCoffeeAssistantTools,
  getAssistantToolActivityEvent,
} from "../../tools/definitions.ts";
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
  toAssistantConversationMessages,
} from "./messages.ts";
import {
  createAssistantGatewayMetadata,
  logAssistantRunCompleted,
  logAssistantRunFailed,
  logAssistantRunStarted,
  logAssistantToolActivity,
} from "./observability.ts";

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

  const response = await Effect.runPromise(
    runAssistantConversation({
      eventId: runId,
      messages: toAssistantConversationMessages(input.body.messages),
      model: input.model,
      requestMetadata: createAssistantGatewayMetadata(input.actor, runId),
      systemPrompt: coffeeAssistantSystemPrompt,
      tools: createCoffeeAssistantTools(runApp, emitActivity),
    }).pipe(
      Effect.tapError((error: unknown) =>
        logAssistantRunFailed({
          actor: input.actor,
          durationMs: performance.now() - startedAt,
          error,
          gatewayEnabled: input.gatewayEnabled,
          model: input.model,
          runId,
        }),
      ),
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

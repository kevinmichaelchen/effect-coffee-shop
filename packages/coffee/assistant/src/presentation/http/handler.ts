/**
 * Handles Beanline assistant HTTP requests and streams model responses.
 *
 * @module
 */
import { toServerSentEventsResponse } from "@tanstack/ai";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FiberSet from "effect/FiberSet";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { HttpObservabilityLive } from "@effect-coffee-shop/http-routing/observability";
import { emptyWebHandlerServices } from "@effect-coffee-shop/http-routing/request-services";
import type { CoffeeAppRunner } from "@effect-coffee-shop/coffee-actions/execute";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import {
  CurrentActor,
  type AppActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { type AssistantModelRunner, type AssistantToolActivity } from "../../application/model.ts";
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

interface PreparedAssistantRequest {
  readonly actor: AppActor;
  readonly appLayer: AssistantHandlerOptions["appLayer"];
  readonly body: AssistantRequestBody;
  readonly gatewayEnabled: boolean;
  readonly model: string;
  readonly queue: AssistantChunkQueue<AssistantStreamChunk>;
}

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
    return unavailableResponse(
      "Set COFFEE_ASSISTANT_MODEL on the selected Beanline AI provider adapter.",
    );
  }

  const body = await parseAssistantRequestBody(request);

  if (body === null) {
    return new Response("Invalid assistant request body.", { status: 400 });
  }

  const abortController = connectAbortSignal(request.signal);
  const queue = createAssistantChunkQueue<AssistantStreamChunk>(abortController.signal);
  const assistant = abortController.signal.aborted
    ? Effect.void
    : streamAssistantResponse({
        actor: options.actor,
        appLayer: options.appLayer,
        body,
        gatewayEnabled: options.gatewayEnabled ?? false,
        model: options.model,
        queue,
      }).pipe(
        Effect.provide(options.modelLayer),
        Effect.provide(HttpObservabilityLive),
        Effect.matchCauseEffect({
          onFailure: (cause) => Effect.sync(() => queue.fail(Cause.squash(cause))),
          onSuccess: () => Effect.void,
        }),
        Effect.scoped,
      );
  const fiber = Effect.runFork(assistant);
  const interruptAssistant = () => {
    Effect.runFork(Fiber.interrupt(fiber));
  };
  abortController.signal.addEventListener("abort", interruptAssistant, { once: true });
  if (abortController.signal.aborted) {
    interruptAssistant();
  }
  fiber.addObserver(() => {
    abortController.signal.removeEventListener("abort", interruptAssistant);
  });

  return toServerSentEventsResponse(queue.stream, {
    abortController,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function streamAssistantResponse(input: PreparedAssistantRequest) {
  return Effect.gen(function* () {
    const activityFibers = yield* FiberSet.make<void, never>();
    const runActivity = yield* FiberSet.runtime(activityFibers)<never>();
    const messageId = createAssistantStreamId("msg");
    const runId = createAssistantStreamId("chat");
    const runApp = createCoffeeAppRunner(input.appLayer, input.actor);
    const startedAt = yield* Effect.sync(() => performance.now());
    let toolCallCount = 0;
    const emitActivity = (activity: AssistantToolActivity) => {
      toolCallCount += Number(activity.kind === "tool-call");

      runActivity(
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
    yield* logAssistantRunStarted({
      actor: input.actor,
      gatewayEnabled: input.gatewayEnabled,
      model: input.model,
      runId,
    });

    const response = yield* runAssistantConversation({
      eventId: runId,
      messages: toAssistantConversationMessages(input.body.messages),
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
    );

    input.queue.push(createAssistantTextStartChunk(messageId, input.model));
    input.queue.push(createAssistantTextContentChunk(messageId, input.model, response));
    input.queue.push(createAssistantTextEndChunk(messageId, input.model));
    input.queue.push(createAssistantRunFinishedChunk(runId, input.model));
    input.queue.close();

    yield* FiberSet.awaitEmpty(activityFibers);
    yield* logAssistantRunCompleted({
      actor: input.actor,
      durationMs: performance.now() - startedAt,
      gatewayEnabled: input.gatewayEnabled,
      model: input.model,
      runId,
      toolCallCount,
    });
  });
}

function createCoffeeAppRunner(
  appLayer: AssistantHandlerOptions["appLayer"],
  actor: AppActor,
): CoffeeAppRunner {
  const liveLayer = CoffeeOrderApp.layer.pipe(Layer.provide(appLayer));
  const services = emptyWebHandlerServices().pipe(Context.add(CurrentActor, actor));

  return (effect) =>
    effect.pipe(
      Effect.provide(liveLayer),
      Effect.provide(HttpObservabilityLive),
      Effect.provide(services),
    );
}

function connectAbortSignal(signal: AbortSignal): AbortController {
  const abortController = new AbortController();
  if (signal.aborted) {
    abortController.abort();
  } else {
    signal.addEventListener("abort", () => abortController.abort(), { once: true });
  }
  return abortController;
}

function unavailableResponse(message: string): Response {
  return new Response(message, {
    status: 503,
  });
}

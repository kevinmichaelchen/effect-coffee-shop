/**
 * Builds assistant model runners for Cloudflare Workers AI bindings and REST.
 *
 * @module
 */
import type { AiTextGenerationInput, AiTextGenerationOutput } from "@cloudflare/workers-types";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type { Redacted } from "effect/Redacted";
import {
  AssistantModelRequestError,
  AssistantModelResponseDecodeError,
  type AssistantRequestMetadata,
  type AssistantModelRunnerService,
  extractResponseText,
} from "../../application/model.ts";
import type { ProviderHttpClient } from "./provider-http.ts";
import { runWorkersAiOverRest } from "./workers-ai-rest.ts";
import {
  createGatewayOptions,
  isToolCall,
  stripToolExecutor,
  toAssistantToolCall,
  toWorkersAiMessages,
  type AssistantGatewayOptions,
} from "./workers-ai-format.ts";

export interface WorkersAiBinding {
  run(
    model: string,
    inputs: AiTextGenerationInput,
    options?: object,
  ): Promise<AiTextGenerationOutput>;
}

export type WorkersAiConfig =
  | {
      readonly kind: "workers-ai-binding";
      readonly binding: WorkersAiBinding;
      readonly gatewayId?: string;
      readonly model: string;
    }
  | {
      readonly kind: "workers-ai-rest";
      readonly accountId: string;
      readonly apiKey: Redacted<string>;
      readonly model: string;
    };

export function makeWorkersAiRunner(
  config: WorkersAiConfig,
  client: ProviderHttpClient,
): AssistantModelRunnerService {
  const runner = createWorkersAiRunner(config, client);

  return {
    run: (request) =>
      runner
        .run(
          config.model,
          {
            max_tokens: request.maxTokens,
            messages: toWorkersAiMessages(request.conversation),
            tools: request.tools.map(stripToolExecutor),
          },
          request.requestMetadata,
          request.eventId,
        )
        .pipe(
          Effect.map((response) => {
            const toolCalls =
              response.tool_calls?.filter(isToolCall).map(toAssistantToolCall) ?? [];

            return {
              text: extractResponseText(response.response),
              toolCalls,
            };
          }),
        ),
  };
}

interface WorkersAiRunner {
  readonly run: (
    model: string,
    inputs: AiTextGenerationInput,
    metadata?: AssistantRequestMetadata,
    eventId?: string,
  ) => Effect.Effect<
    AiTextGenerationOutput,
    AssistantModelRequestError | AssistantModelResponseDecodeError
  >;
}

function createWorkersAiRunner(
  config: WorkersAiConfig,
  client: ProviderHttpClient,
): WorkersAiRunner {
  if (config.kind === "workers-ai-binding") {
    return {
      run: (model, inputs, metadata, eventId) => {
        const options = createGatewayOptions(config.gatewayId, metadata, eventId);

        if (options === undefined) {
          return runWorkersAiBinding(config.binding, model, inputs);
        }

        return runWorkersAiBinding(config.binding, model, inputs, options);
      },
    };
  }

  return {
    run: (model, inputs) =>
      runWorkersAiOverRest({
        accountId: config.accountId,
        apiKey: config.apiKey,
        client,
        model,
        request: inputs,
      }),
  };
}

function runWorkersAiBinding(
  binding: WorkersAiBinding,
  model: string,
  inputs: AiTextGenerationInput,
  options?: AssistantGatewayOptions,
): Effect.Effect<AiTextGenerationOutput, AssistantModelRequestError> {
  return Effect.tryPromise({
    try: () =>
      Option.match(Option.fromUndefinedOr(options), {
        onNone: () => binding.run(model, inputs),
        onSome: (options) => binding.run(model, inputs, options),
      }),
    catch: () =>
      new AssistantModelRequestError({
        message: "Workers AI binding request failed.",
        provider: "Workers AI",
      }),
  });
}

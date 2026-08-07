/**
 * Selects concrete assistant model provider adapters.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as ScopedCache from "effect/ScopedCache";
import { AssistantModelRunner, type AssistantModelRunnerService } from "../../application/model.ts";
import { type OllamaConfig, makeOllamaRunner } from "./ollama-runtime.ts";
import { makeProviderHttpClient, ProviderHttpLive } from "./provider-http.ts";
import {
  type WorkersAiBinding,
  type WorkersAiConfig,
  makeWorkersAiRunner,
} from "./workers-ai-runtime.ts";

const defaultOllamaEndpoint = "http://localhost:11434";
const assistantProviderOllama = "ollama";
const assistantProviderWorkersAi = "workers-ai";
const assistantProviderWorkersAiRest = "workers-ai-rest";
const decodeTrimmedString = Schema.decodeUnknownSync(Schema.Trim);

export type AssistantAiConfig = OllamaConfig | WorkersAiConfig;

export function getAssistantAiConfigFromEnv(
  env: Record<string, string | undefined>,
): AssistantAiConfig | undefined {
  const provider = readOptionalEnv(env.COFFEE_ASSISTANT_PROVIDER);
  const model = readOptionalEnv(env.COFFEE_ASSISTANT_MODEL);
  const ollamaEndpoint =
    readOptionalEnv(env.COFFEE_ASSISTANT_OLLAMA_URL) ?? readOptionalEnv(env.OLLAMA_HOST);
  const accountId = readOptionalEnv(env.CLOUDFLARE_ACCOUNT_ID);
  const apiKey = readOptionalEnv(env.CLOUDFLARE_API_TOKEN);
  const workersAiRestConfig = getWorkersAiRestConfig({
    accountId,
    apiKey,
    model,
  });
  const explicitProviderConfig: Option.Option<Option.Option<AssistantAiConfig>> = Match.value(
    provider,
  ).pipe(
    Match.when(assistantProviderOllama, (): Option.Option<Option.Option<OllamaConfig>> =>
      Option.some(
        getOllamaConfig({
          endpoint: ollamaEndpoint ?? defaultOllamaEndpoint,
          model,
        }),
      ),
    ),
    Match.when(assistantProviderWorkersAi, () => Option.some(workersAiRestConfig)),
    Match.when(assistantProviderWorkersAiRest, () => Option.some(workersAiRestConfig)),
    Match.orElse(() => Option.none()),
  );
  const ambientOllamaConfig = getOllamaConfig({
    endpoint: ollamaEndpoint,
    model,
  });

  return explicitProviderConfig.pipe(
    Option.match({
      onNone: () =>
        Option.getOrUndefined(Option.firstSomeOf([workersAiRestConfig, ambientOllamaConfig])),
      onSome: Option.getOrUndefined,
    }),
  );
}

export const getBunAssistantAiConfig = getAssistantAiConfigFromEnv;

export function createWorkersAiBindingConfig(input: {
  readonly binding: WorkersAiBinding;
  readonly gatewayId: string | undefined;
  readonly model: string | undefined;
}): WorkersAiConfig | undefined {
  return Option.fromUndefinedOr(readOptionalEnv(input.model)).pipe(
    Option.map((model) =>
      Option.match(Option.fromUndefinedOr(input.gatewayId), {
        onNone: () =>
          createWorkersAiBindingConfigValue({
            binding: input.binding,
            model,
          }),
        onSome: (gatewayId) =>
          createWorkersAiBindingConfigValue({
            binding: input.binding,
            gatewayId,
            model,
          }),
      }),
    ),
    Option.getOrUndefined,
  );
}

function createWorkersAiBindingConfigValue(input: {
  readonly binding: WorkersAiBinding;
  readonly gatewayId?: string;
  readonly model: string;
}): WorkersAiConfig {
  return Option.match(Option.fromUndefinedOr(input.gatewayId), {
    onNone: () => ({
      kind: "workers-ai-binding",
      binding: input.binding,
      model: input.model,
    }),
    onSome: (gatewayId) => ({
      kind: "workers-ai-binding",
      binding: input.binding,
      gatewayId,
      model: input.model,
    }),
  });
}

export function getAssistantModelLabel(config: AssistantAiConfig): string {
  return config.model;
}

export function createAssistantModelRunner(
  config: AssistantAiConfig,
  client: Parameters<typeof makeWorkersAiRunner>[1],
): AssistantModelRunnerService {
  return Match.value(config).pipe(
    Match.when({ kind: "ollama" }, (ollamaConfig) => makeOllamaRunner(ollamaConfig, client)),
    Match.orElse((workersAiConfig) => makeWorkersAiRunner(workersAiConfig, client)),
  );
}

export function createAssistantModelRunnerLayer(
  config: AssistantAiConfig,
): Layer.Layer<AssistantModelRunner> {
  return Layer.effect(
    AssistantModelRunner,
    Effect.gen(function* () {
      const client = yield* makeProviderHttpClient();
      const runnerCache = yield* ScopedCache.make({
        capacity: 1,
        lookup: (_model: string) => Effect.succeed(createAssistantModelRunner(config, client)),
        timeToLive: "1 hour",
      });

      return yield* ScopedCache.get(runnerCache, getAssistantModelLabel(config));
    }).pipe(Effect.provide(ProviderHttpLive)),
  );
}

function getOllamaConfig(input: {
  readonly endpoint: string | undefined;
  readonly model: string | undefined;
}): Option.Option<OllamaConfig> {
  return Option.all({
    endpoint: Option.fromUndefinedOr(input.endpoint),
    model: Option.fromUndefinedOr(input.model),
  }).pipe(
    Option.map(({ endpoint, model }) => ({
      kind: "ollama",
      endpoint,
      model,
    })),
  );
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
  readonly model: string | undefined;
}): Option.Option<WorkersAiConfig> {
  return Option.all({
    accountId: Option.fromUndefinedOr(input.accountId),
    apiKey: Option.fromUndefinedOr(input.apiKey),
    model: Option.fromUndefinedOr(input.model),
  }).pipe(
    Option.map(({ accountId, apiKey, model }) => ({
      kind: "workers-ai-rest",
      accountId,
      apiKey: Redacted.make(apiKey, { label: "CLOUDFLARE_API_TOKEN" }),
      model,
    })),
  );
}

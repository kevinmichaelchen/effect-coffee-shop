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
import * as Ollama from "./ollama-runtime.ts";
import * as ProviderHttp from "./provider-http.ts";
import * as WorkersAi from "./workers-ai-runtime.ts";

const defaultOllamaEndpoint = "http://localhost:11434";
const assistantProviderOllama = "ollama";
const assistantProviderWorkersAi = "workers-ai";
const assistantProviderWorkersAiRest = "workers-ai-rest";
const decodeTrimmedString = Schema.decodeUnknownSync(Schema.Trim);

export type AssistantAiConfig = Ollama.OllamaConfig | WorkersAi.WorkersAiConfig;

export function getAssistantAiConfigFromEnv(
  // oxlint-disable-next-line effect/prefer-option-over-null -- Native environment adapter accepts/emits undefined; decoded runtime configuration uses Option.
  env: Record<string, string | undefined>,
): Option.Option<AssistantAiConfig> {
  const provider = readOptionalEnv(env.COFFEE_ASSISTANT_PROVIDER);
  const model = readOptionalEnv(env.COFFEE_ASSISTANT_MODEL);
  const ollamaEndpoint = readOptionalEnv(env.COFFEE_ASSISTANT_OLLAMA_URL).pipe(
    Option.orElse(() => readOptionalEnv(env.OLLAMA_HOST)),
  );
  const accountId = readOptionalEnv(env.CLOUDFLARE_ACCOUNT_ID);
  const apiKey = readOptionalEnv(env.CLOUDFLARE_API_TOKEN);
  const workersAiRestConfig = getWorkersAiRestConfig({
    accountId,
    apiKey,
    model,
  });
  const explicitProviderConfig: Option.Option<Option.Option<AssistantAiConfig>> = Match.value(
    Option.getOrUndefined(provider),
  ).pipe(
    Match.when(assistantProviderOllama, (): Option.Option<Option.Option<Ollama.OllamaConfig>> =>
      Option.some(
        getOllamaConfig({
          endpoint: ollamaEndpoint.pipe(Option.orElse(() => Option.some(defaultOllamaEndpoint))),
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
      onNone: () => Option.firstSomeOf([workersAiRestConfig, ambientOllamaConfig]),
      onSome: (config) => config,
    }),
  );
}

export const getBunAssistantAiConfig = getAssistantAiConfigFromEnv;

export function createWorkersAiBindingConfig(input: {
  readonly binding: WorkersAi.WorkersAiBinding;
  readonly gatewayId: Option.Option<string>;
  readonly model: Option.Option<string>;
}): Option.Option<WorkersAi.WorkersAiConfig> {
  return input.model
    .pipe(
      Option.map(decodeTrimmedString),
      Option.filter((model) => model !== ""),
    )
    .pipe(
      Option.map((model) =>
        Option.match(input.gatewayId, {
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
    );
}

function createWorkersAiBindingConfigValue(input: {
  readonly binding: WorkersAi.WorkersAiBinding;
  readonly gatewayId?: string;
  readonly model: string;
}): WorkersAi.WorkersAiConfig {
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
  client: Parameters<typeof WorkersAi.makeWorkersAiRunner>[1],
): AssistantModelRunnerService {
  return Match.value(config).pipe(
    Match.when({ kind: "ollama" }, (ollamaConfig) => Ollama.makeOllamaRunner(ollamaConfig, client)),
    Match.orElse((workersAiConfig) => WorkersAi.makeWorkersAiRunner(workersAiConfig, client)),
  );
}

export function createAssistantModelRunnerLayer(
  config: AssistantAiConfig,
): Layer.Layer<AssistantModelRunner> {
  return Layer.effect(
    AssistantModelRunner,
    Effect.gen(function* () {
      const client = yield* ProviderHttp.makeProviderHttpClient();
      const runnerCache = yield* ScopedCache.make({
        capacity: 1,
        lookup: (_model: string) => Effect.succeed(createAssistantModelRunner(config, client)),
        timeToLive: "1 hour",
      });

      return yield* ScopedCache.get(runnerCache, getAssistantModelLabel(config));
    }),
  ).pipe(Layer.provide(ProviderHttp.ProviderHttpLive));
}

function getOllamaConfig(input: {
  readonly endpoint: Option.Option<string>;
  readonly model: Option.Option<string>;
}): Option.Option<Ollama.OllamaConfig> {
  return Option.all({
    endpoint: input.endpoint,
    model: input.model,
  }).pipe(
    Option.map(({ endpoint, model }) => ({
      kind: "ollama",
      endpoint,
      model,
    })),
  );
}

// oxlint-disable-next-line effect/prefer-option-over-null -- Native environment adapter accepts/emits undefined; decoded runtime configuration uses Option.
function readOptionalEnv(value: string | undefined): Option.Option<string> {
  return Option.some(decodeTrimmedString(value ?? "")).pipe(
    Option.filter((trimmedValue) => trimmedValue !== ""),
  );
}

function getWorkersAiRestConfig(input: {
  readonly accountId: Option.Option<string>;
  readonly apiKey: Option.Option<string>;
  readonly model: Option.Option<string>;
}): Option.Option<WorkersAi.WorkersAiConfig> {
  return Option.all({
    accountId: input.accountId,
    apiKey: input.apiKey,
    model: input.model,
  }).pipe(
    Option.map(({ accountId, apiKey, model }) => ({
      kind: "workers-ai-rest",
      accountId,
      apiKey: Redacted.make(apiKey, { label: "CLOUDFLARE_API_TOKEN" }),
      model,
    })),
  );
}

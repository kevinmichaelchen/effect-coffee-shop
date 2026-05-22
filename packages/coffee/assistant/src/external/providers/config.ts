/**
 * Selects concrete assistant model provider adapters.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { AssistantModelRunner, type AssistantModelRunnerService } from "../../application/model.ts";
import { type OllamaConfig, makeOllamaRunner } from "./ollama-runtime.ts";
import { type WorkersAiConfig, makeWorkersAiRunner } from "./workers-ai-runtime.ts";

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
  const ollamaEndpoint =
    readOptionalEnv(env.COFFEE_ASSISTANT_OLLAMA_URL) ?? readOptionalEnv(env.OLLAMA_HOST);
  const accountId = readOptionalEnv(env.CLOUDFLARE_ACCOUNT_ID);
  const apiKey = readOptionalEnv(env.CLOUDFLARE_API_TOKEN);
  const workersAiRestConfig = getWorkersAiRestConfig({
    accountId,
    apiKey,
  });
  const explicitProviderConfig: Option.Option<Option.Option<AssistantAiConfig>> = Match.value(
    provider,
  ).pipe(
    Match.when(
      assistantProviderOllama,
      (): Option.Option<Option.Option<OllamaConfig>> =>
        Option.some(
          Option.some({
            kind: "ollama",
            endpoint: ollamaEndpoint ?? defaultOllamaEndpoint,
          }),
        ),
    ),
    Match.when(assistantProviderWorkersAi, () => Option.some(workersAiRestConfig)),
    Match.when(assistantProviderWorkersAiRest, () => Option.some(workersAiRestConfig)),
    Match.orElse(() => Option.none()),
  );
  const ambientOllamaConfig: Option.Option<OllamaConfig> = Option.map(
    Option.fromUndefinedOr(ollamaEndpoint),
    (endpoint) => ({
      kind: "ollama",
      endpoint,
    }),
  );

  return explicitProviderConfig.pipe(
    Option.match({
      onNone: () =>
        Option.getOrUndefined(Option.firstSomeOf([workersAiRestConfig, ambientOllamaConfig])),
      onSome: Option.getOrUndefined,
    }),
  );
}

export const getBunAssistantAiConfig = getAssistantAiConfigFromEnv;

export function getAssistantModel(
  env?: Record<string, string | undefined>,
  ai?: AssistantAiConfig,
): string | undefined {
  return Option.match(Option.fromUndefinedOr(readOptionalEnv(env?.COFFEE_ASSISTANT_MODEL)), {
    onNone: () =>
      Match.value(ai?.kind).pipe(
        Match.when("ollama", () => undefined),
        Match.orElse(() => getDefaultWorkersAiModel()),
      ),
    onSome: (model) => model,
  });
}

export function createAssistantModelRunner(config: AssistantAiConfig): AssistantModelRunnerService {
  return Match.value(config).pipe(
    Match.when({ kind: "ollama" }, makeOllamaRunner),
    Match.orElse(makeWorkersAiRunner),
  );
}

export function createAssistantModelRunnerLayer(
  config: AssistantAiConfig,
): Layer.Layer<AssistantModelRunner> {
  return Layer.succeed(AssistantModelRunner)(createAssistantModelRunner(config));
}

function getDefaultWorkersAiModel(): string {
  return "@cf/meta/llama-3.1-8b-instruct-fast";
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
}): Option.Option<WorkersAiConfig> {
  return Option.all({
    accountId: Option.fromUndefinedOr(input.accountId),
    apiKey: Option.fromUndefinedOr(input.apiKey),
  }).pipe(
    Option.map(({ accountId, apiKey }) => ({
      kind: "workers-ai-rest",
      accountId,
      apiKey: Redacted.make(apiKey, { label: "CLOUDFLARE_API_TOKEN" }),
    })),
  );
}

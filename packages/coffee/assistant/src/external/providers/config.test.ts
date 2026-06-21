/**
 * Verifies assistant provider environment selection.
 *
 * @module
 */
import * as Redacted from "effect/Redacted";
import { describe, expect, it } from "vitest";
import { getAssistantAiConfigFromEnv } from "./index.ts";

const assistantModel = "@cf/meta/llama-3.1-8b-instruct-fast";
const localAssistantModel = "qwen3-beanline";

const verifyWorkersAiRestEnvWinsOverAmbientOllama = () => {
  const config = getAssistantAiConfigFromEnv({
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    CLOUDFLARE_API_TOKEN: "token",
    COFFEE_ASSISTANT_MODEL: assistantModel,
    OLLAMA_HOST: "http://localhost:11434",
  });

  expect(config?.kind).toBe("workers-ai-rest");

  if (config?.kind !== "workers-ai-rest") {
    return;
  }

  expect(config.accountId).toBe("account-id");
  expect(Redacted.value(config.apiKey)).toBe("token");
  expect(config.model).toBe(assistantModel);
};

const verifyExplicitOllamaEnv = () => {
  const config = getAssistantAiConfigFromEnv({
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    CLOUDFLARE_API_TOKEN: "token",
    COFFEE_ASSISTANT_MODEL: localAssistantModel,
    COFFEE_ASSISTANT_PROVIDER: "ollama",
  });

  expect(config).toEqual({
    endpoint: "http://localhost:11434",
    kind: "ollama",
    model: localAssistantModel,
  });
};

const verifyProviderRequiresModel = () => {
  const config = getAssistantAiConfigFromEnv({
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    CLOUDFLARE_API_TOKEN: "token",
  });

  expect(config).toBeUndefined();
};

const verifyExplicitWorkersAiRequiresCredentials = () => {
  const config = getAssistantAiConfigFromEnv({
    COFFEE_ASSISTANT_MODEL: assistantModel,
    COFFEE_ASSISTANT_PROVIDER: "workers-ai",
    OLLAMA_HOST: "http://localhost:11434",
  });

  expect(config).toBeUndefined();
};

describe("assistant provider config", () => {
  it("requires the app composition root to choose an assistant model", verifyProviderRequiresModel);
  it(
    "prefers configured Workers AI credentials over an ambient Ollama host",
    verifyWorkersAiRestEnvWinsOverAmbientOllama,
  );
  it("uses Ollama only when explicitly selected without an endpoint", verifyExplicitOllamaEnv);
  it(
    "does not fall back to Ollama when Workers AI is explicitly selected without credentials",
    verifyExplicitWorkersAiRequiresCredentials,
  );
});

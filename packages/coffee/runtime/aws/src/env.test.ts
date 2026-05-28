/**
 * Tests AWS Lambda runtime configuration decoding.
 *
 * @module
 */
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { describe, expect, it } from "vitest";
import { readAwsRuntime, type AwsLambdaEnv } from "./env.ts";

describe("aws runtime config", () => {
  it("normalizes optional secrets, assistant config, and staff ids", () => {
    const runtime = readAwsRuntime({
      BETTER_AUTH_SECRET: " secret-123 ",
      CLOUDFLARE_ACCOUNT_ID: " account-123 ",
      CLOUDFLARE_API_TOKEN: " token-123 ",
      COFFEE_ASSISTANT_MODEL: " @cf/example/model ",
      COFFEE_ASSISTANT_PROVIDER: " workers-ai-rest ",
      COFFEE_STAFF_USER_IDS: " staff-a, staff-b , , staff-a ",
    } satisfies AwsLambdaEnv);

    const assistantAi = Option.getOrUndefined(runtime.config.assistantAi);

    expect(Option.map(runtime.config.betterAuthSecret, Redacted.value)).toEqual(
      Option.some("secret-123"),
    );
    expect([...runtime.config.staffUserIds]).toEqual(["staff-a", "staff-b"]);
    expect(assistantAi?.kind).toBe("workers-ai-rest");

    if (assistantAi?.kind !== "workers-ai-rest") {
      return;
    }

    expect(assistantAi.accountId).toBe("account-123");
    expect(Redacted.value(assistantAi.apiKey)).toBe("token-123");
    expect(assistantAi.model).toBe("@cf/example/model");
  });

  it("treats missing or blank optional values as absent", () => {
    const runtime = readAwsRuntime({
      BETTER_AUTH_SECRET: " ",
      CLOUDFLARE_ACCOUNT_ID: "",
      CLOUDFLARE_API_TOKEN: "   ",
      COFFEE_ASSISTANT_MODEL: " ",
      COFFEE_ASSISTANT_PROVIDER: "",
      COFFEE_STAFF_USER_IDS: " ,  , ",
      OLLAMA_HOST: " ",
    } satisfies AwsLambdaEnv);

    expect(Option.isNone(runtime.config.assistantAi)).toBe(true);
    expect(Option.isNone(runtime.config.betterAuthSecret)).toBe(true);
    expect([...runtime.config.staffUserIds]).toEqual([]);
  });

  it("supports explicit Ollama provider configuration", () => {
    const runtime = readAwsRuntime({
      COFFEE_ASSISTANT_MODEL: " qwen3-beanline ",
      COFFEE_ASSISTANT_OLLAMA_URL: " http://localhost:11434 ",
      COFFEE_ASSISTANT_PROVIDER: " ollama ",
    } satisfies AwsLambdaEnv);

    expect(Option.getOrUndefined(runtime.config.assistantAi)).toEqual({
      endpoint: "http://localhost:11434",
      kind: "ollama",
      model: "qwen3-beanline",
    });
  });
});

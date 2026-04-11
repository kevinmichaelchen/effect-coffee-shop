import type {
  AiTextGenerationInput,
  AiTextGenerationOutput,
  D1Database,
} from "@cloudflare/workers-types";

export type AssetFetcher = { fetch(request: Request): Promise<Response> };

export interface WorkersAiBinding {
  run(
    model: string,
    inputs: AiTextGenerationInput,
    options?: object,
  ): Promise<AiTextGenerationOutput>;
}

export interface OnionCloudflareWorkerEnv {
  AI?: WorkersAiBinding;
  AI_GATEWAY_ID?: string;
  BETTER_AUTH_SECRET?: string;
  COFFEE_STAFF_USER_IDS?: string;
  DB: D1Database;
  ASSETS?: AssetFetcher;
}

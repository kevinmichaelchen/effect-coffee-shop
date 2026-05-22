import { createAwsRequestServices } from "../coffee-backend.ts";
import type { AwsRuntime } from "../env.ts";
import { makeCoffeeHttpApiMount } from "../../../host/http-api-mount.ts";
import { resolveAwsRequestActor } from "./request-actor.ts";

export const awsHttpApiMount = makeCoffeeHttpApiMount<AwsRuntime>({
  createRequestServices: createAwsRequestServices,
  resolveRequestActor: async ({ env, request }) =>
    resolveAwsRequestActor({ runtime: env, request }),
});

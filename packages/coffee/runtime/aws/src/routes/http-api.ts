/**
 * Routes the Coffee HTTP API inside the AWS runtime.
 *
 * @module
 */
import { createAwsRequestServices } from "../backend.ts";
import type { AwsRuntime } from "../env.ts";
import { makeCoffeeApiRoute } from "@effect-coffee-shop/coffee-backend/http/api-route";
import { resolveAwsRequestActor } from "./request-actor.ts";

export const httpApiRoute = makeCoffeeApiRoute<AwsRuntime>({
  createRequestServices: createAwsRequestServices,
  resolveRequestActor: ({ env, request }) => resolveAwsRequestActor({ runtime: env, request }),
});

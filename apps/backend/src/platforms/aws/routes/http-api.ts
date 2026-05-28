/**
 * Routes the Coffee HTTP API inside the AWS runtime.
 *
 * @module
 */
import { createAwsRequestServices } from "../coffee-backend.ts";
import type { AwsRuntime } from "../env.ts";
import { makeCoffeeHttpApiRoute } from "../../../http/http-api-route.ts";
import { resolveAwsRequestActor } from "./request-actor.ts";

export const awsHttpApiRoute = makeCoffeeHttpApiRoute<AwsRuntime>({
  createRequestServices: createAwsRequestServices,
  resolveRequestActor: ({ env, request }) => resolveAwsRequestActor({ runtime: env, request }),
});

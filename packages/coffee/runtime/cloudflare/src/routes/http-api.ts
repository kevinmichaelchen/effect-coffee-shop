import type { CloudflareWorkerEnv } from "../env.ts";
import { createCloudflareRequestServices } from "../backend.ts";
import { makeCoffeeApiRoute } from "@effect-coffee-shop/coffee-backend/http/api-route";
import { resolveCloudflareRequestActor } from "./request-actor.ts";

export const httpApiRoute = makeCoffeeApiRoute<CloudflareWorkerEnv>({
  createRequestServices: createCloudflareRequestServices,
  resolveRequestActor: resolveCloudflareRequestActor,
});

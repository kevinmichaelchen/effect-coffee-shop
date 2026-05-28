import type { CloudflareWorkerEnv } from "../env.ts";
import { createCloudflareRequestServices } from "../backend.ts";
import { makeCoffeeApiRoute } from "../../../http/api-route.ts";
import { resolveCloudflareRequestActor } from "./request-actor.ts";

export const httpApiRoute = makeCoffeeApiRoute<CloudflareWorkerEnv>({
  createRequestServices: createCloudflareRequestServices,
  resolveRequestActor: resolveCloudflareRequestActor,
});

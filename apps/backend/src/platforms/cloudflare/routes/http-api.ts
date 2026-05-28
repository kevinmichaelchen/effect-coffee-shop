import type { CloudflareWorkerEnv } from "../env.ts";
import { createCloudflareRequestServices } from "../coffee-backend.ts";
import { makeCoffeeHttpApiRoute } from "../../../http/http-api-route.ts";
import { resolveCloudflareRequestActor } from "./request-actor.ts";

export const cloudflareHttpApiRoute = makeCoffeeHttpApiRoute<CloudflareWorkerEnv>({
  createRequestServices: createCloudflareRequestServices,
  resolveRequestActor: resolveCloudflareRequestActor,
});

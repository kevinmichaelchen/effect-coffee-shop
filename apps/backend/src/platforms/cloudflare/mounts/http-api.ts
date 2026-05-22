/**
 * Mounts the Coffee HTTP API inside the Cloudflare Worker runtime.
 *
 * @module
 */
import type { CloudflareWorkerEnv } from "../env.ts";
import { createCloudflareRequestServices } from "../coffee-backend.ts";
import { makeCoffeeHttpApiMount } from "../../../host/http-api-mount.ts";
import { resolveCloudflareRequestActor } from "./request-actor.ts";

export const cloudflareHttpApiMount = makeCoffeeHttpApiMount<CloudflareWorkerEnv>({
  createRequestServices: createCloudflareRequestServices,
  resolveRequestActor: resolveCloudflareRequestActor,
});

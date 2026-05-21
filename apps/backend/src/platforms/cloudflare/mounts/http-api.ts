import * as Option from "effect/Option";
import { actorLogFields } from "@effect-coffee-shop/backend-host/logging";
import type { CloudflareWorkerEnv } from "../env.ts";
import { rejectDirectHttpBearerRequest } from "../direct-http-auth.ts";
import {
  cloudflarePathIsOrStartsWith,
  cloudflareResponse,
  rewriteRequestPathPrefix,
  type CloudflareMount,
} from "@effect-coffee-shop/backend-host/mount";
import { createCloudflareRequestServices } from "../coffee-backend.ts";
import { resolveCloudflareRequestActor } from "./request-actor.ts";

const isApiRequest = (request: Request): boolean => cloudflarePathIsOrStartsWith(request, "/api");

const rewriteApiRequest = (request: Request): Request => rewriteRequestPathPrefix(request, "/api");

export const cloudflareHttpApiMount: CloudflareMount<CloudflareWorkerEnv> = {
  name: "api",
  matches: isApiRequest,
  handle: async ({ env, request }) =>
    Option.match(rejectDirectHttpBearerRequest(request), {
      onNone: async () => {
        const { actor, backend } = await resolveCloudflareRequestActor({ env, request });

        return cloudflareResponse(
          await backend.handler(rewriteApiRequest(request), createCloudflareRequestServices(actor)),
          actorLogFields(actor),
        );
      },
      onSome: async (response: Response) => cloudflareResponse(response),
    }),
};

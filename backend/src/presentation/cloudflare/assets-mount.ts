import type { OnionCloudflareWorkerEnv } from "#presentation/cloudflare/context";
import { cloudflareResponse, type CloudflareMount } from "#presentation/cloudflare/mount";

const notFoundResponse = () => new Response("Not Found", { status: 404 });

export const cloudflareAssetsMount: CloudflareMount<OnionCloudflareWorkerEnv> = {
  name: "assets",
  matches: () => true,
  handle: async ({ env, request }) =>
    cloudflareResponse(
      env.ASSETS === undefined ? notFoundResponse() : await env.ASSETS.fetch(request),
    ),
};

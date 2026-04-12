import * as Option from "effect/Option";
import { readCloudflareRuntime, type CloudflareWorkerEnv } from "#presentation/cloudflare/context";
import { cloudflareResponse, type CloudflareMount } from "#presentation/cloudflare/mount";

const notFoundResponse = () => new Response("Not Found", { status: 404 });

export const cloudflareAssetsMount: CloudflareMount<CloudflareWorkerEnv> = {
  name: "assets",
  matches: () => true,
  handle: async ({ env, request }) => {
    const runtime = readCloudflareRuntime(env);

    return cloudflareResponse(
      await Option.match(runtime.bindings.assets, {
        onNone: async () => notFoundResponse(),
        onSome: async (assets) => assets.fetch(request),
      }),
    );
  },
};

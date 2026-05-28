/**
 * Serves static asset requests from the Cloudflare assets binding.
 *
 * @module
 */
import * as Option from "effect/Option";
import * as Effect from "effect/Effect";
import { cloudflareBindingNames, type CloudflareWorkerEnv } from "../env.ts";
import { fetchResponse, type FetchRoute } from "@effect-coffee-shop/fetch-host/route";

const notFoundResponse = () => new Response("Not Found", { status: 404 });

export const cloudflareAssetsRoute: FetchRoute<CloudflareWorkerEnv> = {
  name: "assets",
  matches: () => true,
  handle: ({ env, request }) =>
    Effect.gen(function* () {
      const assetsBinding = Option.fromNullishOr(env[cloudflareBindingNames.assets]);
      const response = yield* Option.match(assetsBinding, {
        onNone: () => Effect.succeed(notFoundResponse()),
        onSome: (assets) => Effect.promise(async () => assets.fetch(request)),
      });

      return fetchResponse(response);
    }),
};

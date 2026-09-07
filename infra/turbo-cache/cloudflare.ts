import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import CacheApi, { Artifacts } from "./cloudflare-worker.ts";

export default Alchemy.Stack(
  "effect-turbo-cache-cloudflare",
  {
    providers: Cloudflare.providers(),
    state: process.env.ALCHEMY_LOCAL_STATE === "true" ? Alchemy.localState() : Cloudflare.state(),
  },
  Effect.gen(function* () {
    const bucket = yield* Artifacts;
    const worker = yield* CacheApi;
    return { url: worker.url, bucketName: bucket.bucketName };
  }),
);

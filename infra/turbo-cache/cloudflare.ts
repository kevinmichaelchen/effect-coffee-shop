import * as Alchemy from "alchemy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import CacheApi, { Artifacts } from "./cloudflare-worker.ts";

export default Alchemy.Stack(
  "effect-turbo-cache-cloudflare",
  {
    providers: Cloudflare.providers(),
    // The state layer reads its backend choice from Config when Alchemy builds it.
    state: Layer.unwrap(
      Config.String("ALCHEMY_LOCAL_STATE").pipe(
        Config.withDefault(""),
        Effect.orDie,
        Effect.map((local) => (local === "true" ? Alchemy.localState() : Cloudflare.state())),
      ),
    ),
  },
  Effect.gen(function* () {
    const bucket = yield* Artifacts;
    const worker = yield* CacheApi;
    return { url: worker.url, bucketName: bucket.bucketName };
  }),
);

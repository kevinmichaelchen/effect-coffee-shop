import * as Alchemy from "alchemy";
import * as AWS from "alchemy/AWS";
import { state } from "alchemy/AWS/StateStore";
import * as Effect from "effect/Effect";
import CacheApi, { Artifacts } from "./aws-service.ts";

export default Alchemy.Stack(
  "effect-turbo-cache-aws",
  {
    providers: AWS.providers(),
    state: state(),
  },
  Effect.gen(function* () {
    const bucket = yield* Artifacts;
    const api = yield* CacheApi;
    return { url: api.url, bucketName: bucket.bucketName };
  }),
);

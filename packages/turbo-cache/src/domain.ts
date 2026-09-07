import * as Schema from "effect/Schema";

export const Identifier = Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9_-]{1,128}$/));
export const ByteLength = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 1, maximum: 90 * 1024 * 1024 }),
);
const HeaderValue = Schema.String.check(Schema.isPattern(/^[\x20-\x7e]{0,1024}$/));

export const ArtifactMetadata = Schema.Struct({
  duration: Schema.String.check(Schema.isPattern(/^\d{1,15}$/)),
  tag: HeaderValue,
  sha: HeaderValue,
  dirtyHash: HeaderValue,
});
export interface ArtifactMetadata extends Schema.Schema.Type<typeof ArtifactMetadata> {}

export class CacheError extends Schema.TaggedError<CacheError>()("CacheError", {
  status: Schema.Number,
  message: Schema.String,
}) {}

export const storageFailure = () =>
  new CacheError({ status: 503, message: "Artifact storage unavailable" });
export const invalidRequest = () =>
  new CacheError({ status: 400, message: "Invalid cache request" });
export const PART_BYTES = 5 * 1024 * 1024;

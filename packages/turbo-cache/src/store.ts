import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import type * as Stream from "effect/Stream";
import type { ArtifactMetadata, CacheError } from "./domain.ts";

export interface StoredArtifact {
  readonly size: number;
  readonly metadata: ArtifactMetadata;
}

export interface Download extends StoredArtifact {
  readonly body: Stream.Stream<Uint8Array, CacheError>;
}

export interface UploadedPart {
  readonly partNumber: number;
  readonly etag: string;
}

export interface Upload {
  readonly write: (part: Uint8Array, partNumber: number) => Effect.Effect<UploadedPart, CacheError>;
  readonly complete: (parts: ReadonlyArray<UploadedPart>) => Effect.Effect<void, CacheError>;
  readonly abort: () => Effect.Effect<void, CacheError>;
}

export class ArtifactStore extends Context.Service<
  ArtifactStore,
  {
    readonly head: (key: string) => Effect.Effect<Option.Option<StoredArtifact>, CacheError>;
    readonly get: (key: string) => Effect.Effect<Option.Option<Download>, CacheError>;
    readonly begin: (key: string, metadata: ArtifactMetadata) => Effect.Effect<Upload, CacheError>;
  }
>()("TurboCache/ArtifactStore") {}

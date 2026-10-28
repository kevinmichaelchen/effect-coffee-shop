import { Schema } from "effect";

/** The two on-device models: LFM3-1.7B for text, LFM3-Audio-2B for speech. */
export const LocalModel = Schema.Literals(["text", "voice"]);
export type LocalModel = typeof LocalModel.Type;

// Audio crosses postMessage as a transferable buffer; this is the one runtime check it needs.
const Samples = Schema.declare(
  (input: unknown): input is Float32Array => input instanceof Float32Array,
);

const ChatMessage = Schema.Struct({
  role: Schema.Literals(["system", "user"]),
  content: Schema.String,
});

/** Main thread → worker. */
export const WorkerRequest = Schema.TaggedUnion({
  Load: { model: LocalModel },
  Generate: {
    id: Schema.String,
    messages: Schema.Array(ChatMessage),
    tools: Schema.Array(Schema.Unknown),
  },
  Transcribe: { id: Schema.String, samples: Samples },
});
export type WorkerRequest = typeof WorkerRequest.Type;

/** Worker → main thread. */
export const WorkerEvent = Schema.TaggedUnion({
  Progressed: { model: LocalModel, loaded: Schema.Finite, total: Schema.Finite },
  Loaded: { model: LocalModel },
  FailedLoad: { model: LocalModel, message: Schema.String },
  Generated: { id: Schema.String, text: Schema.String },
  Transcribed: { id: Schema.String, text: Schema.String },
  Failed: { id: Schema.String, message: Schema.String },
  /** The worker itself broke; every request still waiting has failed. */
  Crashed: { message: Schema.String },
});
export type WorkerEvent = typeof WorkerEvent.Type;

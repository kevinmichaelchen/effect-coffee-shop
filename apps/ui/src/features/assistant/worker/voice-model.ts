import { Data, Effect } from "effect";

export class VoiceModelError extends Data.TaggedError("VoiceModelError")<{
  readonly message: string;
}> {}

/** Placeholder until the LFM3-Audio runner lands. */
export interface VoiceModel {
  readonly _tag: "VoiceModel";
}

export const loadVoiceModel = (_onProgress: (loaded: number, total: number) => void) =>
  Effect.fail(new VoiceModelError({ message: "Voice input is not available yet." }));

export const transcribe = (_model: VoiceModel, _samples: Float32Array) =>
  Effect.fail(new VoiceModelError({ message: "Voice input is not available yet." }));

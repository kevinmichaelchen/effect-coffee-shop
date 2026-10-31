import { Effect, Schema } from "effect";
import { ManagedResource } from "foldkit";

class MicrophoneError extends Schema.TaggedError<
  MicrophoneError,
  { readonly brand: unique symbol }
>()("MicrophoneError", { message: Schema.String }) {}

/** A live recording: the recorder plus the chunks it has produced so far. */
interface Recording {
  readonly recorder: MediaRecorder;
  readonly chunks: Blob[];
}

/** Held only while the Model says the customer is speaking (or being transcribed). */
export const Microphone = ManagedResource.tag<Recording>()("Microphone");

const sampleRate = 16_000;

const stopTracks = (recorder: MediaRecorder) =>
  Effect.sync(() => recorder.stream.getTracks().forEach((track) => track.stop()));

/** Asks for the microphone and starts recording; the tracks stop when the scope closes. */
export const acquireMicrophone = Effect.acquireRelease(
  Effect.tryPromise({
    try: async () => navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } }),
    catch: () => new MicrophoneError({ message: "Microphone access was blocked." }),
  }).pipe(
    Effect.map((stream) => {
      const recording: Recording = { recorder: new MediaRecorder(stream), chunks: [] };
      recording.recorder.addEventListener("dataavailable", (event) =>
        recording.chunks.push(event.data),
      );
      recording.recorder.start();
      return recording;
    }),
  ),
  ({ recorder }) => stopTracks(recorder),
);

const stopped = (recorder: MediaRecorder) =>
  Effect.callback<void>((resume) => {
    if (recorder.state === "inactive") return resume(Effect.void);
    recorder.addEventListener("stop", () => resume(Effect.void), { once: true });
    recorder.stop();
  });

/** Decoding at 16 kHz lets the browser resample to what LFM3-Audio expects. */
const toSamples = (blob: Blob) =>
  Effect.tryPromise({
    try: async () => {
      const context = new AudioContext({ sampleRate });
      const audio = await context.decodeAudioData(await blob.arrayBuffer());
      await context.close();
      return audio.getChannelData(0);
    },
    catch: () => new MicrophoneError({ message: "That recording could not be read." }),
  });

/** Ends the current recording and returns it as 16 kHz mono samples. */
export const finishRecording = Effect.gen(function* () {
  const { recorder, chunks } = yield* Microphone.get.pipe(
    Effect.mapError(() => new MicrophoneError({ message: "Nothing is being recorded." })),
  );
  yield* stopped(recorder);
  yield* stopTracks(recorder);
  return yield* toSamples(new Blob(chunks, { type: recorder.mimeType }));
});

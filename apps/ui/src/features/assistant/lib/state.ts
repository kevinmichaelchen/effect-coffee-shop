import { Option, Schema } from "effect";
import { OrderDraft } from "#features/coffee-shop/lib/coffee-schemas.ts";
import { AssistantTurn } from "#features/assistant/lib/tools.ts";

/** Where one on-device model is: off, downloading, usable, or broken. */
export const LocalModelStatus = Schema.TaggedUnion({
  Off: {},
  Loading: { loaded: Schema.Finite, total: Schema.Finite },
  Ready: {},
  Failed: { message: Schema.String },
});
export type LocalModelStatus = typeof LocalModelStatus.Type;

const RecordingState = Schema.Literals(["idle", "acquiring", "recording", "transcribing"]);

export const AssistantState = Schema.Struct({
  text: LocalModelStatus,
  voice: LocalModelStatus,
  workerAcquired: Schema.Boolean,
  prompt: Schema.String,
  isThinking: Schema.Boolean,
  /** The one request whose answer is still wanted; anything else that arrives is stale. */
  pendingRequest: Schema.Option(Schema.Int),
  requestCount: Schema.Int,
  /** The recording being transcribed; its id must match the transcript that comes back. */
  pendingRecording: Schema.Option(Schema.Int),
  recording: RecordingState,
  heard: Schema.Option(Schema.String),
  turn: Schema.Option(AssistantTurn),
  undo: Schema.Option(OrderDraft),
  error: Schema.Option(Schema.String),
});
export type AssistantState = typeof AssistantState.Type;

export const initialAssistant: AssistantState = {
  text: LocalModelStatus.cases.Off.make({}),
  voice: LocalModelStatus.cases.Off.make({}),
  workerAcquired: false,
  prompt: "",
  isThinking: false,
  pendingRequest: Option.none(),
  requestCount: 0,
  pendingRecording: Option.none(),
  recording: "idle",
  heard: Option.none(),
  turn: Option.none(),
  undo: Option.none(),
  error: Option.none(),
};

export const isReady = (status: LocalModelStatus): boolean => status._tag === "Ready";

/** The worker runs while either model is loading or loaded. */
export const wantsWorker = (state: AssistantState): boolean =>
  state.text._tag === "Loading" || state.text._tag === "Ready";

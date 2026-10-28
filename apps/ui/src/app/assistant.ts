import { Option } from "effect";
import type { Update } from "foldkit";
import { type AssistantState, isReady, LocalModelStatus } from "#features/assistant/lib/state.ts";
import type { LocalModel } from "#features/assistant/lib/protocol.ts";
import type { AssistantRequest, AssistantTurn } from "#features/assistant/lib/tools.ts";
import { usualDraft } from "#features/coffee-shop/lib/usual.ts";
import { AskAssistant, DetectWebGpu, LoadLocalModel, TranscribeRecording } from "#app/command.ts";
import { composerFor, patchDraft } from "#app/draft.ts";
import type { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";
import type { AppServices } from "#app/resources.ts";

type Return = Update.Return<Model, Message, AppServices>;

const withAssistant = (model: Model, change: Partial<AssistantState>): Model => ({
  ...model,
  assistant: { ...model.assistant, ...change },
});

const setStatus = (model: Model, which: LocalModel, status: LocalModelStatus): Model =>
  withAssistant(model, which === "text" ? { text: status } : { voice: status });

const statusOf = (model: Model, which: LocalModel): LocalModelStatus =>
  which === "text" ? model.assistant.text : model.assistant.voice;

const loading = LocalModelStatus.cases.Loading.make({ loaded: 0, total: 0 });

// LOADING

export const enableAssistant = (model: Model): Return =>
  model.assistant.text._tag === "Loading" || isReady(model.assistant.text)
    ? { model }
    : { model: withAssistant(model, { error: Option.none() }), commands: [DetectWebGpu()] };

/** Switching the text model to Loading starts the worker; its acquisition then loads the model. */
export const receiveWebGpu = (model: Model, isSupported: boolean): Return => ({
  model: setStatus(
    model,
    "text",
    isSupported
      ? loading
      : LocalModelStatus.cases.Failed.make({
          message: "Local AI needs WebGPU. Try a recent Chrome, Edge, or Safari 26.",
        }),
  ),
});

export const loadTextModel = (model: Model): Return => ({
  model,
  commands: [LoadLocalModel({ model: "text" })],
});

export const enableVoice = (model: Model): Return =>
  isReady(model.assistant.text) &&
  model.assistant.voice._tag !== "Loading" &&
  !isReady(model.assistant.voice)
    ? { model: setStatus(model, "voice", loading), commands: [LoadLocalModel({ model: "voice" })] }
    : { model };

export const receiveProgress = (
  model: Model,
  which: LocalModel,
  loaded: number,
  total: number,
): Return => ({
  model:
    statusOf(model, which)._tag === "Loading"
      ? setStatus(model, which, LocalModelStatus.cases.Loading.make({ loaded, total }))
      : model,
});

export const receiveLoaded = (model: Model, which: LocalModel): Return => ({
  model: setStatus(model, which, LocalModelStatus.cases.Ready.make({})),
});

/** A failed text model also stops the worker; turning it on again starts a fresh one. */
export const receiveLoadFailed = (model: Model, which: LocalModel, message: string): Return => ({
  model: setStatus(model, which, LocalModelStatus.cases.Failed.make({ message })),
});

// ASKING

const requestFor = (model: Model): AssistantRequest => ({
  page: model.route._tag === "Staff" ? "staff" : "shop",
  prompt: model.assistant.prompt.trim(),
  menu: model.menu,
  draft: Option.map(composerFor(model.menu, model.draft), ({ draft }) => draft),
  orders: model.orders,
});

export const submitPrompt = (model: Model): Return =>
  !isReady(model.assistant.text) ||
  model.assistant.isThinking ||
  model.assistant.prompt.trim().length === 0
    ? { model }
    : {
        model: withAssistant(model, {
          isThinking: true,
          error: Option.none(),
          turn: Option.none(),
        }),
        commands: [AskAssistant({ request: requestFor(model) })],
      };

/** Draft edits apply now and keep the old draft for undo; proposals wait for a tap. */
export const receiveTurn = (model: Model, turn: AssistantTurn): Return => {
  const settled = withAssistant(model, {
    isThinking: false,
    prompt: "",
    turn: Option.some(turn),
    undo: Option.none(),
  });
  if (turn._tag !== "UpdatedDraft") return { model: settled };
  const before = Option.map(composerFor(model.menu, model.draft), ({ draft }) => draft);
  return {
    model: withAssistant(
      { ...settled, draft: patchDraft(model.menu, model.draft, turn.patch) },
      { undo: before },
    ),
  };
};

export const receiveTurnFailed = (model: Model, message: string): Return => ({
  model: withAssistant(model, { isThinking: false, error: Option.some(message) }),
});

export const undoEdit = (model: Model): Return =>
  Option.match(model.assistant.undo, {
    onNone: () => ({ model }),
    onSome: (draft) => ({
      model: withAssistant(
        { ...model, draft: Option.some(draft) },
        { undo: Option.none(), turn: Option.none() },
      ),
    }),
  });

/** Acting on a proposal (or leaving the page) settles the turn. */
export const settleTurn = (model: Model): Model =>
  withAssistant(model, { turn: Option.none(), undo: Option.none(), heard: Option.none() });

/** The frequency table's pick: the drink this customer has ordered most. */
export const useUsual = (model: Model): Return =>
  Option.match(usualDraft(model.orders, model.menu), {
    onNone: () => ({ model }),
    onSome: (draft) => ({ model: { ...model, draft: Option.some(draft) } }),
  });

// VOICE

export const startRecording = (model: Model): Return =>
  isReady(model.assistant.voice) &&
  model.assistant.recording === "idle" &&
  !model.assistant.isThinking
    ? { model: withAssistant(model, { recording: "recording", error: Option.none() }) }
    : { model };

export const stopRecording = (model: Model): Return =>
  model.assistant.recording === "recording"
    ? {
        model: withAssistant(model, { recording: "transcribing" }),
        commands: [TranscribeRecording()],
      }
    : { model };

export const receiveRecordingFailed = (model: Model, message: string): Return => ({
  model: withAssistant(model, { recording: "idle", error: Option.some(message) }),
});

/** What was heard becomes the prompt, shown to the customer and sent at once. */
export const receiveTranscript = (model: Model, text: string): Return => {
  const heard = text.trim();
  const idle = withAssistant(model, { recording: "idle" });
  return heard.length === 0
    ? { model: withAssistant(idle, { error: Option.some("I didn't catch that. Try again.") }) }
    : submitPrompt(withAssistant(idle, { prompt: heard, heard: Option.some(heard) }));
};

import { Option } from "effect";
import { Command, given, message, model, story } from "foldkit/story";
import { expect as sceneExpect, given as sceneGiven, label, role, scene } from "foldkit/scene";
import { describe, expect, test, vi } from "vitest";
import { AssistantTurn } from "#features/assistant/lib/tools.ts";

// The Api clients need the Alchemy runtime; these tests only need Command identities.
vi.mock("#features/coffee-shop/api/coffee.ts", async () => {
  const { Effect } = await import("effect");
  return {
    createOrder: () => Effect.never,
    fetchMenu: Effect.never,
    updateOrderStatus: () => Effect.never,
  };
});
vi.mock("#features/auth/auth-client.ts", () => ({
  authClient: {
    register: async () => ({ ok: true, message: "" }),
    signIn: async () => ({ ok: true, message: "" }),
    signOut: async () => ({ ok: true, message: "" }),
  },
}));
// The assistant worker and the microphone need Web Workers and media devices.
vi.mock("#features/assistant/api/assistant-worker.ts", async () => {
  const { Effect } = await import("effect");
  return {
    acquireAssistantWorker: Effect.never,
    AssistantWorker: { get: Effect.never },
    generateReply: () => Effect.never,
    loadModel: () => Effect.never,
    workerNotices: Effect.never,
    transcribeSamples: () => Effect.never,
  };
});
vi.mock("#features/assistant/api/microphone.ts", async () => {
  const { Effect } = await import("effect");
  return {
    acquireMicrophone: Effect.never,
    finishRecording: Effect.never,
    Microphone: { get: Effect.never },
  };
});

const { AskAssistant, DetectWebGpu, LoadLocalModel } = await import("#app/command.ts");
const { init } = await import("#app/main.ts");
const { Message } = await import("#app/message.ts");
const { update } = await import("#app/update.ts");
const { view } = await import("#app/view/root.ts");
const { initialAssistant, LocalModelStatus } = await import("#features/assistant/lib/state.ts");

const url = (pathname: string) => ({
  protocol: "https:",
  host: "coffee.test",
  port: Option.none(),
  pathname,
  search: Option.none(),
  hash: Option.none(),
});

const bootModel = (pathname: string) => init({ theme: "light" }, url(pathname)).model;

const customer = { kind: "customer", displayName: "Ada", userId: "user-1" } as const;

const latte = {
  id: "latte",
  name: "Latte",
  kind: "espresso",
  basePriceCents: 450,
  availableMilks: ["whole", "oat"],
  availableTemperatures: ["hot", "iced"],
  maxShots: 3,
} as const;

/** The composer's default latte: what the assistant's edits start from. */
const latteDraft = {
  drinkId: "latte",
  size: "medium",
  milk: "whole",
  temperature: "hot",
  shots: 1,
  quantity: 1,
  notes: "",
} as const;

const ready = LocalModelStatus.cases.Ready.make({});

const signedIn = { ...bootModel("/shop"), viewer: customer, menu: [latte] };
const textReady = { ...signedIn, assistant: { ...initialAssistant, text: ready } };
const voiceReady = { ...textReady, assistant: { ...textReady.assistant, voice: ready } };
/** An answer is only wanted while its request is the pending one. */
const awaiting = {
  ...textReady,
  draft: Option.some(latteDraft),
  assistant: {
    ...textReady.assistant,
    isThinking: true,
    pendingRequest: Option.some(1),
    requestCount: 1,
  },
};
const transcribing = {
  ...voiceReady,
  assistant: { ...voiceReady.assistant, recording: "transcribing" },
} as const;

const replied = AssistantTurn.cases.Replied.make({ text: "One oat latte coming up." });

describe("local model", () => {
  test("turning local AI on detects WebGPU, starts the worker, then loads the text model", () => {
    story(
      update,
      given(bootModel("/shop")),
      message(Message.ClickedEnableAssistant()),
      Command.expectExact(DetectWebGpu),
      Command.resolve(DetectWebGpu, Message.DetectedWebGpu({ isSupported: false })),
      model((next) => {
        expect(next.assistant.text._tag).toBe("Failed");
        expect(next.assistant.text).toEqual(
          LocalModelStatus.cases.Failed.make({
            message: "Local AI needs WebGPU. Try a recent Chrome, Edge, or Safari 26.",
          }),
        );
      }),
      message(Message.ClickedEnableAssistant()),
      Command.expectExact(DetectWebGpu),
      Command.resolve(DetectWebGpu, Message.DetectedWebGpu({ isSupported: true })),
      model((next) => expect(next.assistant.text._tag).toBe("Loading")),
      message(Message.AcquiredAssistantWorker()),
      Command.expectExact(LoadLocalModel({ model: "text" })),
      Command.resolve(LoadLocalModel, Message.LoadedLocalModel({ model: "text" })),
      model((next) => expect(next.assistant.text._tag).toBe("Ready")),
    );
  });
});

describe("asking", () => {
  test("a prompt is sent once the text model is ready", () => {
    story(
      update,
      given(textReady),
      message(Message.ChangedAssistantPrompt({ value: "a large oat latte" })),
      Command.expectNone(),
      message(Message.SubmittedAssistantPrompt()),
      Command.expectExact(AskAssistant),
      model((next) => {
        expect(next.assistant.isThinking).toBe(true);
        expect(next.assistant.prompt).toBe("a large oat latte");
      }),
      Command.resolve(AskAssistant, Message.GotAssistantTurn({ requestId: 1, turn: replied })),
      model((next) => {
        expect(next.assistant.isThinking).toBe(false);
        expect(next.assistant.prompt).toBe("");
      }),
    );
  });

  test("a blank prompt sends nothing", () => {
    story(
      update,
      given({ ...textReady, assistant: { ...textReady.assistant, prompt: "   " } }),
      message(Message.SubmittedAssistantPrompt()),
      Command.expectNone(),
      model((next) => expect(next.assistant.isThinking).toBe(false)),
    );
  });
});

describe("assistant turns", () => {
  test("a draft edit applies at once, keeps the old draft, and undoes", () => {
    story(
      update,
      given(awaiting),
      message(
        Message.GotAssistantTurn({
          requestId: 1,
          turn: AssistantTurn.cases.UpdatedDraft.make({
            patch: { drinkId: "latte", milk: "oat", extraShots: 1 },
            text: "Oat latte with an extra shot.",
          }),
        }),
      ),
      Command.expectNone(),
      model((next) => {
        expect(next.draft).toEqual(Option.some({ ...latteDraft, milk: "oat", shots: 2 }));
        expect(next.assistant.undo).toEqual(Option.some(latteDraft));
        expect(next.assistant.prompt).toBe("");
      }),
      message(Message.ClickedUndoAssistantEdit()),
      Command.expectNone(),
      model((next) => {
        expect(next.draft).toEqual(Option.some(latteDraft));
        expect(Option.isNone(next.assistant.undo)).toBe(true);
      }),
    );
  });

  test("a proposed order waits for the customer's tap", () => {
    const proposed = AssistantTurn.cases.ProposedPlaceOrder.make({
      text: "Ready to send this to the baristas?",
    });
    story(
      update,
      given(awaiting),
      message(Message.GotAssistantTurn({ requestId: 1, turn: proposed })),
      Command.expectNone(),
      model((next) => {
        expect(next.assistant.turn).toEqual(Option.some(proposed));
        expect(next.assistant.isThinking).toBe(false);
        expect(next.isPlacingOrder).toBe(false);
        expect(next.draft).toEqual(Option.some(latteDraft));
      }),
    );
  });
});

describe("voice", () => {
  test("a transcript becomes the prompt and is sent at once", () => {
    story(
      update,
      given(transcribing),
      message(Message.GotTranscript({ text: "a latte" })),
      Command.expectExact(AskAssistant),
      model((next) => {
        expect(next.assistant.heard).toEqual(Option.some("a latte"));
        expect(next.assistant.prompt).toBe("a latte");
        expect(next.assistant.recording).toBe("idle");
        expect(next.assistant.isThinking).toBe(true);
      }),
      Command.resolve(AskAssistant, Message.GotAssistantTurn({ requestId: 1, turn: replied })),
    );
  });

  test("an empty transcript asks the customer to try again", () => {
    story(
      update,
      given(transcribing),
      message(Message.GotTranscript({ text: "  " })),
      Command.expectNone(),
      model((next) => {
        expect(next.assistant.error).toEqual(Option.some("I didn't catch that. Try again."));
        expect(next.assistant.prompt).toBe("");
        expect(Option.isNone(next.assistant.heard)).toBe(true);
        expect(next.assistant.recording).toBe("idle");
      }),
    );
  });
});

describe("stale work", () => {
  test("an answer to an abandoned request changes nothing", () => {
    story(
      update,
      given(awaiting),
      message(Message.ChangedUrl({ url: url("/staff") })),
      model((next) => {
        expect(next.assistant.isThinking).toBe(false);
        expect(Option.isNone(next.assistant.pendingRequest)).toBe(true);
      }),
      message(
        Message.GotAssistantTurn({
          requestId: 1,
          turn: AssistantTurn.cases.UpdatedDraft.make({ patch: { milk: "oat" }, text: "" }),
        }),
      ),
      model((next) => {
        expect(next.draft).toEqual(Option.some(latteDraft));
        expect(Option.isNone(next.assistant.turn)).toBe(true);
      }),
    );
  });

  test("leaving the page releases the microphone and ignores its late transcript", () => {
    story(
      update,
      given(transcribing),
      message(Message.ChangedUrl({ url: url("/staff") })),
      model((next) => expect(next.assistant.recording).toBe("idle")),
      message(Message.GotTranscript({ text: "a latte" })),
      Command.expectNone(),
      model((next) => expect(next.assistant.prompt).toBe("")),
    );
  });

  test("recording starts when the microphone arrives, and Stop before that cancels", () => {
    story(
      update,
      given(voiceReady),
      message(Message.ClickedStartRecording()),
      model((next) => expect(next.assistant.recording).toBe("acquiring")),
      message(Message.ClickedStopRecording()),
      Command.expectNone(),
      model((next) => expect(next.assistant.recording).toBe("idle")),
      message(Message.ClickedStartRecording()),
      message(Message.AcquiredMicrophone()),
      model((next) => expect(next.assistant.recording).toBe("recording")),
    );
  });
});

describe("shop page", () => {
  test("signed-in customers are offered local AI", () => {
    scene(
      { update, view },
      sceneGiven(signedIn),
      sceneExpect(role("button", { name: "Turn on local AI" })).toExist(),
    );
  });

  test("once the text model is ready, the assistant offers a prompt field", () => {
    scene(
      { update, view },
      sceneGiven(textReady),
      sceneExpect(label("Ask the assistant")).toExist(),
    );
  });
});

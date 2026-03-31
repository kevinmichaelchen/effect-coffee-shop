import { Effect } from "effect";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { processAssistantTurn } from "#features/assistant/lib/assistant-loop.ts";
import { getLfmCacheStatus } from "#features/assistant/lib/lfm-cache.ts";
import { type BrowserChatMessage, LfmBrowserModel } from "#features/assistant/lib/lfm-browser.ts";
import { CoffeeMcpClient, type PromptToolDefinition } from "#features/assistant/lib/mcp-client.ts";
import {
  assistantPrompts,
  createInitialAssistantState,
  isBusyStatus,
  reduceAssistantState,
  type AssistantUiMessage,
} from "#features/assistant/hooks/lfmAssistantSupport.ts";

interface AssistantRuntime {
  client: CoffeeMcpClient | null;
  conversation: BrowserChatMessage[];
  model: LfmBrowserModel | null;
  tools: readonly PromptToolDefinition[] | null;
}

type AssistantDispatch = (message: AssistantUiMessage) => void;

const refreshAssistantCacheStatus = Effect.fn("LfmAssistant.refreshAssistantCacheStatus")(function* (
  dispatch: AssistantDispatch,
): Effect.fn.Return<void> {
  const cacheStatus = yield* Effect.promise(async () => getLfmCacheStatus());
  yield* dispatchMessage(dispatch, { type: "cache-status-refreshed", cacheStatus });
});

const loadPromptTools = Effect.fn("LfmAssistant.loadPromptTools")(function* (
  runtime: AssistantRuntime,
): Effect.fn.Return<readonly PromptToolDefinition[], Error> {
  if (runtime.tools !== null) {
    return runtime.tools;
  }

  const tools = yield* Effect.tryPromise({
    try: async () => getClient(runtime).getPromptTools(),
    catch: (cause) => asError(cause, "Unable to load Coffee Shop tools."),
  });
  runtime.tools = tools;
  return tools;
});

const loadBrowserModel = Effect.fn("LfmAssistant.loadBrowserModel")(function* (
  runtime: AssistantRuntime,
  dispatch: AssistantDispatch,
): Effect.fn.Return<void, Error> {
  yield* Effect.tryPromise({
    try: async () =>
      getModel(runtime).load((progress) => {
        dispatch({ type: "model-progressed", progress });
      }),
    catch: (cause) => asError(cause, "Unable to load the local browser model."),
  });
});

const ensureAssistantReady = Effect.fn("LfmAssistant.ensureAssistantReady")(function* (
  runtime: AssistantRuntime,
  dispatch: AssistantDispatch,
): Effect.fn.Return<readonly PromptToolDefinition[], Error> {
  const needsModel = !getModel(runtime).isLoaded();
  const needsTools = runtime.tools === null;

  if (needsModel || needsTools) {
    yield* dispatchMessage(dispatch, { type: "runtime-preparing" });
  }

  const tools = yield* loadPromptTools(runtime);
  if (needsModel) {
    yield* loadBrowserModel(runtime, dispatch);
    yield* refreshAssistantCacheStatus(dispatch);
  }

  return tools;
});

const warmUpAssistant = Effect.fn("LfmAssistant.warmUpAssistant")(function* (
  runtime: AssistantRuntime,
  dispatch: AssistantDispatch,
): Effect.fn.Return<void, Error> {
  const tools = yield* ensureAssistantReady(runtime, dispatch);
  yield* dispatchMessage(dispatch, { type: "warm-up-completed", toolCount: tools.length });
});

const submitAssistantPrompt = Effect.fn("LfmAssistant.submitAssistantPrompt")(function* (
  runtime: AssistantRuntime,
  dispatch: AssistantDispatch,
  prompt: string,
): Effect.fn.Return<void, Error> {
  runtime.conversation = [...runtime.conversation, { content: prompt, role: "user" }];
  yield* dispatchMessage(dispatch, { type: "user-submitted", prompt });

  const tools = yield* ensureAssistantReady(runtime, dispatch);
  yield* dispatchMessage(dispatch, { type: "assistant-running" });

  const result = yield* Effect.tryPromise({
    try: async () =>
      processAssistantTurn({
        client: getClient(runtime),
        conversation: runtime.conversation,
        model: getModel(runtime),
        onDraft: (text) => {
          dispatch({ type: "assistant-draft-updated", text });
        },
        tools,
      }),
    catch: (cause) => asError(cause, "The local assistant could not complete that request."),
  });

  runtime.conversation = [...result.conversation];
  yield* dispatchMessage(dispatch, {
    type: "assistant-completed",
    assistantText: result.assistantText,
    events: result.events,
    toolCount: tools.length,
  });
});

export function useLfmCoffeeAssistant() {
  const [state, setState] = useState(createInitialAssistantState);
  const runtimeRef = useRef<AssistantRuntime>({
    client: null,
    conversation: [],
    model: null,
    tools: null,
  });

  const dispatch = useCallback((message: AssistantUiMessage) => {
    startTransition(() => {
      setState((current) => reduceAssistantState(current, message));
    });
  }, []);

  useEffect(() => {
    runAssistantEffect(dispatch, refreshAssistantCacheStatus(dispatch));
  }, [dispatch]);

  const { resetConversation, setInput, submit, warmUp } = useAssistantActions({
    dispatch,
    runtimeRef,
    state,
  });

  return {
    assistantDraft: state.assistantDraft,
    cacheStatus: state.cacheStatus,
    errorMessage: state.errorMessage,
    events: state.events,
    hasLoadedModel: state.hasLoadedModel,
    input: state.input,
    isBusy: isBusyStatus(state.status),
    messages: state.messages,
    prompts: assistantPrompts,
    resetConversation,
    setInput,
    status: state.status,
    submit,
    warmUp,
  };
}

function useAssistantActions(input: {
  dispatch: AssistantDispatch;
  runtimeRef: { current: AssistantRuntime };
  state: ReturnType<typeof createInitialAssistantState>;
}) {
  const { dispatch, runtimeRef, state } = input;

  const setInput = (value: string) => {
    dispatch({ type: "input-changed", value });
  };

  const resetConversation = () => {
    runtimeRef.current.conversation = [];
    dispatch({ type: "conversation-reset" });
  };

  const warmUp = () => {
    runAssistantEffect(dispatch, warmUpAssistant(runtimeRef.current, dispatch));
  };

  const submit = (rawInput?: string) => {
    const prompt = (rawInput ?? state.input).trim();
    if (prompt === "" || isBusyStatus(state.status)) {
      return;
    }

    runAssistantEffect(dispatch, submitAssistantPrompt(runtimeRef.current, dispatch, prompt));
  };

  return {
    resetConversation,
    setInput,
    submit,
    warmUp,
  };
}

function getClient(runtime: AssistantRuntime): CoffeeMcpClient {
  if (runtime.client === null) {
    runtime.client = new CoffeeMcpClient();
  }

  return runtime.client;
}

function getModel(runtime: AssistantRuntime): LfmBrowserModel {
  if (runtime.model === null) {
    runtime.model = new LfmBrowserModel();
  }

  return runtime.model;
}

function dispatchMessage(
  dispatch: AssistantDispatch,
  message: AssistantUiMessage,
): Effect.Effect<void> {
  return Effect.sync(() => {
    dispatch(message);
  });
}

function runAssistantEffect(
  dispatch: AssistantDispatch,
  effect: Effect.Effect<void, Error>,
): void {
  void Effect.runPromise(
    effect.pipe(
      Effect.catch((error) =>
        dispatchMessage(dispatch, {
          type: "assistant-failed",
          message: toFailureMessage(error),
        }),
      ),
    ),
  );
}

function asError(cause: unknown, fallback: string): Error {
  if (cause instanceof Error) {
    return cause;
  }

  return new Error(fallback);
}

function toFailureMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The local assistant could not complete that request.";
}

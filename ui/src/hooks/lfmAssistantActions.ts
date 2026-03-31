import { startTransition } from "react";
import { processAssistantTurn } from "#lib/assistant-loop";
import {
  getClient,
  getModel,
  handleError,
  prepareModel,
  queueAssistantResult,
  queueUserMessage,
  type DemoRefs,
  type DemoSetters,
  type DemoStatus,
} from "#hooks/lfmAssistantSupport";

interface UseAssistantActionsInput extends DemoRefs, DemoSetters {
  input: string;
  readyStatus: DemoStatus;
  statusPhase: DemoStatus["phase"];
}

export function useAssistantActions(input: UseAssistantActionsInput) {
  const { clientRef, conversationRef, input: draftInput, modelRef, readyStatus, setAssistantDraft, setCacheStatus, setErrorMessage, setEvents, setHasLoadedModel, setInput, setMessages, setStatus, statusPhase, toolsRef } = input;

  return {
    resetConversation: () =>
      executeResetConversation({
        conversationRef,
        readyStatus,
        setAssistantDraft,
        setEvents,
        setMessages,
        setStatus,
      }),
    submit: async (rawInput?: string) =>
      executeSubmit({
        clientRef,
        conversationRef,
        input: draftInput,
        modelRef,
        setAssistantDraft,
        setCacheStatus,
        setErrorMessage,
        setEvents,
        setHasLoadedModel,
        setInput,
        setMessages,
        setStatus,
        statusPhase,
        toolsRef,
        ...(rawInput === undefined ? {} : { rawInput }),
      }),
    warmUp: async () =>
      executeWarmUp({
        clientRef,
        modelRef,
        setCacheStatus,
        setErrorMessage,
        setHasLoadedModel,
        setStatus,
        toolsRef,
      }),
  };
}

async function executeWarmUp(input: {
  clientRef: DemoRefs["clientRef"];
  modelRef: DemoRefs["modelRef"];
  setCacheStatus: DemoSetters["setCacheStatus"];
  setErrorMessage: DemoSetters["setErrorMessage"];
  setHasLoadedModel: DemoSetters["setHasLoadedModel"];
  setStatus: DemoSetters["setStatus"];
  toolsRef: DemoRefs["toolsRef"];
}) {
  const { clientRef, modelRef, setCacheStatus, setErrorMessage, setHasLoadedModel, setStatus, toolsRef } = input;

  try {
    setErrorMessage(null);
    const tools = await prepareModel({
      clientRef,
      modelRef,
      setCacheStatus,
      setStatus,
      toolsRef,
    });
    setHasLoadedModel(true);
    setStatus({
      label: `Model ready in this tab with ${tools.length} Coffee Shop tools.`,
      phase: "ready",
      progress: 100,
    });
  } catch (error) {
    handleError(error, setErrorMessage, setStatus);
  }
}

async function executeSubmit(input: DemoRefs &
  DemoSetters & {
    input: string;
    rawInput?: string;
    statusPhase: DemoStatus["phase"];
  }) {
  const { clientRef, conversationRef, input: draftInput, modelRef, rawInput, setAssistantDraft, setCacheStatus, setErrorMessage, setEvents, setHasLoadedModel, setInput, setMessages, setStatus, statusPhase, toolsRef } = input;
  const prompt = (rawInput ?? draftInput).trim();
  if (prompt === "" || statusPhase === "loading" || statusPhase === "running") {
    return;
  }

  queueUserMessage({
    conversationRef,
    prompt,
    setErrorMessage,
    setInput,
    setMessages,
    setStatus,
  });

  try {
    const tools = await prepareModel({
      clientRef,
      modelRef,
      setCacheStatus,
      setStatus,
      toolsRef,
    });
    setHasLoadedModel(true);
    const result = await processAssistantTurn({
      client: getClient(clientRef),
      conversation: conversationRef.current,
      model: getModel(modelRef),
      onDraft: setAssistantDraft,
      tools,
    });
    queueAssistantResult({
      conversationRef,
      result,
      setAssistantDraft,
      setEvents,
      setMessages,
      setStatus,
      toolCount: tools.length,
    });
  } catch (error) {
    setAssistantDraft("");
    handleError(error, setErrorMessage, setStatus);
  }
}

function executeResetConversation(input: {
  conversationRef: DemoRefs["conversationRef"];
  readyStatus: DemoStatus;
  setAssistantDraft: DemoSetters["setAssistantDraft"];
  setEvents: DemoSetters["setEvents"];
  setMessages: DemoSetters["setMessages"];
  setStatus: DemoSetters["setStatus"];
}) {
  const { conversationRef, readyStatus, setAssistantDraft, setEvents, setMessages, setStatus } = input;
  conversationRef.current = [];
  startTransition(() => {
    setAssistantDraft("");
    setEvents([]);
    setMessages([]);
    setStatus(readyStatus);
  });
}

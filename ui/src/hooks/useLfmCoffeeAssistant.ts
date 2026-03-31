import { useEffect, useRef, useState } from "react";
import { type AssistantEvent } from "#lib/assistant-loop";
import { type BrowserChatMessage, type LfmBrowserModel } from "#lib/lfm-browser";
import { type CoffeeMcpClient, type PromptToolDefinition } from "#lib/mcp-client";
import { useAssistantActions } from "#hooks/lfmAssistantActions";
import {
  defaultCacheStatus,
  isBusyStatus,
  refreshCacheStatus,
  type DemoCacheStatus,
  type DemoMessage,
  type DemoSetters,
  type DemoStatus,
} from "#hooks/lfmAssistantSupport";

const prompts = [
  "What drinks are on the menu right now?",
  "Place a medium oat latte for Maya with one extra shot.",
  "List open orders and tell me which tickets are ready to pick up.",
] as const;

const readyStatus: DemoStatus = {
  label: "Type a prompt to start. The first run downloads the browser model if needed.",
  phase: "idle",
  progress: 0,
};

export function useLfmCoffeeAssistant() {
  const [assistantDraft, setAssistantDraft] = useState("");
  const [cacheStatus, setCacheStatus] = useState<DemoCacheStatus>(defaultCacheStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<readonly AssistantEvent[]>([]);
  const [hasLoadedModel, setHasLoadedModel] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<readonly DemoMessage[]>([]);
  const [status, setStatus] = useState<DemoStatus>(readyStatus);
  const conversationRef = useRef<BrowserChatMessage[]>([]);
  const modelRef = useRef<LfmBrowserModel | null>(null);
  const clientRef = useRef<CoffeeMcpClient | null>(null);
  const toolsRef = useRef<readonly PromptToolDefinition[] | null>(null);

  useBrowserCacheStatus(setCacheStatus);
  const actions = useAssistantActions({
    clientRef,
    conversationRef,
    input,
    readyStatus,
    modelRef,
    setAssistantDraft,
    setCacheStatus,
    setErrorMessage,
    setEvents,
    setHasLoadedModel,
    setInput,
    setMessages,
    setStatus,
    statusPhase: status.phase,
    toolsRef,
  });

  return {
    assistantDraft,
    cacheStatus,
    errorMessage,
    events,
    hasLoadedModel,
    input,
    isBusy: isBusyStatus(status),
    messages,
    prompts,
    resetConversation: actions.resetConversation,
    setInput,
    status,
    submit: actions.submit,
    warmUp: actions.warmUp,
  };
}

function useBrowserCacheStatus(setCacheStatus: DemoSetters["setCacheStatus"]): void {
  useEffect(() => {
    void refreshCacheStatus(setCacheStatus);
  }, [setCacheStatus]);
}

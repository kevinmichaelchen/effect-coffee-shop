import { fetchServerSentEvents } from "@tanstack/ai-client";
import { useChat } from "@tanstack/ai-react";
import { useCallback, useState } from "react";
import {
  assistantPrompts,
  assistantToolActivityEvent,
  getAssistantStatus,
  getDisplayMessages,
  isAssistantToolActivity,
  type AssistantToolActivity,
} from "#features/assistant/lib/assistant-chat.ts";

const assistantConnection = fetchServerSentEvents("/api/assistant");

export function useCoffeeAssistant() {
  const [events, setEvents] = useState<readonly AssistantToolActivity[]>([]);
  const [input, setInput] = useState("");
  const handleCustomEvent = useCallback((eventType: string, data: unknown) => {
    if (eventType === assistantToolActivityEvent && isAssistantToolActivity(data)) {
      setEvents((current) => [...current, data]);
    }
  }, []);
  const chat = useChat({
    connection: assistantConnection,
    onCustomEvent: handleCustomEvent,
  });
  const errorMessage = chat.error?.message ?? null;
  const status = getAssistantStatus({
    connectionStatus: chat.connectionStatus,
    errorMessage,
    isBusy: chat.isLoading,
  });

  const resetConversation = () => {
    chat.clear();
    setEvents([]);
    setInput("");
  };

  const submit = async (rawInput?: string) => {
    const prompt = (rawInput ?? input).trim();
    if (prompt === "" || chat.isLoading) {
      return;
    }

    setInput("");
    await chat.sendMessage(prompt).catch(() => undefined);
  };

  return {
    connectionStatus: chat.connectionStatus,
    errorMessage,
    events,
    input,
    isBusy: chat.isLoading,
    messages: getDisplayMessages(chat.messages),
    prompts: assistantPrompts,
    resetConversation,
    setInput,
    status,
    submit,
  };
}

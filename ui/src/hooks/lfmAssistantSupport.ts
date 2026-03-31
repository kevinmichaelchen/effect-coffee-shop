import { startTransition, type Dispatch, type RefObject, type SetStateAction } from "react";
import { processAssistantTurn, type AssistantEvent } from "#lib/assistant-loop";
import { defaultLfmCacheStatus, getLfmCacheStatus, type LfmCacheStatus } from "#lib/lfm-cache";
import { LfmBrowserModel, type BrowserChatMessage, type ModelProgressUpdate } from "#lib/lfm-browser";
import { CoffeeMcpClient, type PromptToolDefinition } from "#lib/mcp-client";

export interface DemoMessage {
  readonly content: string;
  readonly id: string;
  readonly role: "assistant" | "user";
}

export interface DemoStatus {
  readonly label: string;
  readonly phase: "error" | "idle" | "loading" | "ready" | "running";
  readonly progress: number;
}

export type DemoCacheStatus = LfmCacheStatus;
export const defaultCacheStatus = defaultLfmCacheStatus;

export interface DemoRefs {
  clientRef: RefObject<CoffeeMcpClient | null>;
  conversationRef: RefObject<BrowserChatMessage[]>;
  modelRef: RefObject<LfmBrowserModel | null>;
  toolsRef: RefObject<readonly PromptToolDefinition[] | null>;
}

export interface DemoSetters {
  setAssistantDraft: Dispatch<SetStateAction<string>>;
  setCacheStatus: Dispatch<SetStateAction<DemoCacheStatus>>;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
  setEvents: Dispatch<SetStateAction<readonly AssistantEvent[]>>;
  setHasLoadedModel: Dispatch<SetStateAction<boolean>>;
  setInput: Dispatch<SetStateAction<string>>;
  setMessages: Dispatch<SetStateAction<readonly DemoMessage[]>>;
  setStatus: Dispatch<SetStateAction<DemoStatus>>;
}

export function getClient(ref: RefObject<CoffeeMcpClient | null>): CoffeeMcpClient {
  if (ref.current === null) {
    ref.current = new CoffeeMcpClient();
  }

  return ref.current;
}

export function getModel(ref: RefObject<LfmBrowserModel | null>): LfmBrowserModel {
  if (ref.current === null) {
    ref.current = new LfmBrowserModel();
  }

  return ref.current;
}

export async function getPromptTools(input: {
  clientRef: RefObject<CoffeeMcpClient | null>;
  toolsRef: RefObject<readonly PromptToolDefinition[] | null>;
}): Promise<readonly PromptToolDefinition[]> {
  const { clientRef, toolsRef } = input;
  if (toolsRef.current !== null) {
    return toolsRef.current;
  }

  toolsRef.current = await getClient(clientRef).getPromptTools();
  return toolsRef.current;
}

export async function prepareModel(input: {
  clientRef: RefObject<CoffeeMcpClient | null>;
  modelRef: RefObject<LfmBrowserModel | null>;
  setCacheStatus: Dispatch<SetStateAction<DemoCacheStatus>>;
  setStatus: Dispatch<SetStateAction<DemoStatus>>;
  toolsRef: RefObject<readonly PromptToolDefinition[] | null>;
}): Promise<readonly PromptToolDefinition[]> {
  const { clientRef, modelRef, setCacheStatus, setStatus, toolsRef } = input;
  setStatus({ label: "Preparing local runtime", phase: "loading", progress: 10 });
  const tools = await getPromptTools({ clientRef, toolsRef });
  await getModel(modelRef).load((progress) => applyProgress(progress, setStatus));
  await refreshCacheStatus(setCacheStatus);
  setStatus({ label: "Thinking with local WebGPU", phase: "running", progress: 100 });
  return tools;
}

export function queueUserMessage(input: {
  conversationRef: RefObject<BrowserChatMessage[]>;
  prompt: string;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
  setInput: Dispatch<SetStateAction<string>>;
  setMessages: Dispatch<SetStateAction<readonly DemoMessage[]>>;
  setStatus: Dispatch<SetStateAction<DemoStatus>>;
}): void {
  const { conversationRef, prompt, setErrorMessage, setInput, setMessages, setStatus } = input;
  startTransition(() => {
    setErrorMessage(null);
    setInput("");
    setMessages((current) => [...current, createMessage("user", prompt)]);
    setStatus({ label: "Thinking with local WebGPU", phase: "running", progress: 100 });
  });

  conversationRef.current = [...conversationRef.current, { content: prompt, role: "user" }];
}

export function queueAssistantResult(input: {
  conversationRef: RefObject<BrowserChatMessage[]>;
  result: Awaited<ReturnType<typeof processAssistantTurn>>;
  setAssistantDraft: Dispatch<SetStateAction<string>>;
  setEvents: Dispatch<SetStateAction<readonly AssistantEvent[]>>;
  setMessages: Dispatch<SetStateAction<readonly DemoMessage[]>>;
  setStatus: Dispatch<SetStateAction<DemoStatus>>;
  toolCount: number;
}): void {
  const { conversationRef, result, setAssistantDraft, setEvents, setMessages, setStatus, toolCount } = input;
  conversationRef.current = [...result.conversation];
  startTransition(() => {
    setAssistantDraft("");
    setEvents((current) => [...current, ...result.events]);
    setMessages((current) => [...current, createMessage("assistant", result.assistantText)]);
    setStatus({
      label: `Model ready in this tab with ${toolCount} Coffee Shop tools.`,
      phase: "ready",
      progress: 100,
    });
  });
}

export function applyProgress(
  progress: ModelProgressUpdate,
  setStatus: Dispatch<SetStateAction<DemoStatus>>,
): void {
  setStatus({ ...progress, phase: "loading" });
}

export function handleError(
  error: unknown,
  setErrorMessage: Dispatch<SetStateAction<string | null>>,
  setStatus: Dispatch<SetStateAction<DemoStatus>>,
): void {
  const message =
    error instanceof Error
      ? error.message
      : "The local assistant could not complete that request.";
  setErrorMessage(message);
  setStatus({ label: "Local demo unavailable", phase: "error", progress: 0 });
}

export function isBusyStatus(status: DemoStatus): boolean {
  return status.phase === "loading" || status.phase === "running";
}

export async function refreshCacheStatus(
  setCacheStatus: Dispatch<SetStateAction<DemoCacheStatus>>,
): Promise<void> {
  const nextStatus = await getLfmCacheStatus();
  startTransition(() => {
    setCacheStatus(nextStatus);
  });
}

function createMessage(role: DemoMessage["role"], content: string): DemoMessage {
  return {
    content,
    id: crypto.randomUUID(),
    role,
  };
}

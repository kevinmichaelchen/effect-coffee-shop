import type { ReactNode } from "react";
import { Alert } from "#shared/ui/retroui/Alert.tsx";
import { Button } from "#shared/ui/retroui/Button.tsx";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { AssistantComposer } from "#features/assistant/components/AssistantComposer.tsx";
import { AssistantStatusPanel } from "#features/assistant/components/AssistantStatusPanel.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import type {
  AssistantDisplayMessage,
  AssistantStatus,
} from "#features/assistant/lib/assistant-chat.ts";
import type { ConnectionStatus } from "@tanstack/ai-client";

interface AssistantTranscriptProps {
  activityControl: ReactNode;
  connectionStatus: ConnectionStatus;
  errorMessage: string | null;
  input: string;
  isBusy: boolean;
  messages: readonly AssistantDisplayMessage[];
  prompts: readonly string[];
  status: AssistantStatus;
  onInputChange: (value: string) => void;
  onPromptClick: (prompt: string) => void;
  onReset: () => void;
  onSubmit: () => void;
}

export function AssistantTranscript(inputProps: AssistantTranscriptProps) {
  const {
    activityControl,
    connectionStatus,
    errorMessage,
    input,
    isBusy,
    messages,
    onInputChange,
    onPromptClick,
    onReset,
    onSubmit,
    prompts,
    status,
  } = inputProps;

  return (
    <Card className="w-full border-border bg-card">
      <Card.Content className="grid gap-4 p-5">
        <TranscriptHeader activityControl={activityControl} onReset={onReset} />
        <AssistantStatusPanel connectionStatus={connectionStatus} isBusy={isBusy} status={status} />
        {errorMessage !== null ? (
          <Alert status="warning">
            <Alert.Title>Assistant warning</Alert.Title>
            <Alert.Description>{errorMessage}</Alert.Description>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <Button key={prompt} size="sm" variant="outline" onClick={() => onPromptClick(prompt)}>
              {prompt}
            </Button>
          ))}
        </div>
        <div className="grid min-h-80 gap-3 border-2 border-border bg-background p-4">
          {messages.length === 0 ? (
            <EmptyTranscript />
          ) : (
            messages.map((message) => (
              <TranscriptBubble key={message.id} content={message.content} speaker={message.role} />
            ))
          )}
        </div>
        <AssistantComposer
          helpText="Cmd/Ctrl + Enter sends the prompt to the same-origin Worker."
          input={input}
          isBusy={isBusy}
          submitLabel={isBusy ? "Calling live tools…" : "Send"}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
        />
      </Card.Content>
    </Card>
  );
}

interface TranscriptHeaderProps {
  activityControl: ReactNode;
  onReset: () => void;
}

function TranscriptHeader({ activityControl, onReset }: TranscriptHeaderProps) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <div className="grid gap-2">
        <Text as="h2" className="text-3xl leading-none md:text-4xl">
          Chat with Beanline over Workers AI.
        </Text>
        <Text as="p" className="max-w-3xl text-sm text-muted-foreground md:text-base">
          The assistant runs through your Cloudflare Worker, calls coffee tools server-side, and
          shares the same D1-backed state as the control room.
        </Text>
      </div>
      <div className="flex flex-wrap gap-3">
        {activityControl}
        <Button variant="outline" onClick={onReset}>
          Clear transcript
        </Button>
      </div>
    </div>
  );
}

function EmptyTranscript() {
  return (
    <div className="grid content-center gap-3 text-center">
      <Text as="h3" className="text-2xl leading-none">
        No messages yet.
      </Text>
      <Text as="p" className="mx-auto max-w-xl text-sm text-muted-foreground">
        Ask Beanline to list the menu, place an order, inspect the queue, or explain what just
        changed in the coffee shop.
      </Text>
    </div>
  );
}

interface TranscriptBubbleProps {
  content: string;
  speaker: AssistantDisplayMessage["role"];
}

function TranscriptBubble({ content, speaker }: TranscriptBubbleProps) {
  const bubbleTone =
    speaker === "assistant"
      ? "border-border bg-card text-card-foreground"
      : "border-black bg-primary text-primary-foreground";
  const labelTone =
    speaker === "assistant" ? "text-muted-foreground" : "text-primary-foreground/70";

  return (
    <div className={`ml-0 grid gap-2 border-2 p-3 shadow-sm ${bubbleTone}`}>
      <Text as="p" className={`text-xs uppercase tracking-[0.08em] ${labelTone}`}>
        {speaker === "assistant" ? "Beanline" : "You"}
      </Text>
      <Text as="p" className="font-sans text-sm leading-6 whitespace-pre-wrap">
        {content}
      </Text>
    </div>
  );
}

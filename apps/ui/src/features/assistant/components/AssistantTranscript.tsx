import type { ReactNode } from "react";
import { Alert } from "#shared/ui/retroui/Alert.tsx";
import { Button } from "#shared/ui/retroui/Button.tsx";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { AssistantComposer } from "#features/assistant/components/AssistantComposer.tsx";
import { AssistantStatusPanel } from "#features/assistant/components/AssistantStatusPanel.tsx";
import { TranscriptViewport } from "#features/assistant/components/TranscriptViewport.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import type {
  AssistantDisplayMessage,
  AssistantStatus,
  AssistantToolActivity,
} from "#features/assistant/lib/assistant-chat.ts";
import type { ConnectionStatus } from "@tanstack/ai-client";

interface AssistantTranscriptProps {
  activityControl: ReactNode;
  connectionStatus: ConnectionStatus;
  errorMessage: string | null;
  input: string;
  isBusy: boolean;
  latestActivity: AssistantToolActivity | null;
  messages: readonly AssistantDisplayMessage[];
  prompts: readonly string[];
  status: AssistantStatus;
  onInputChange: (value: string) => void;
  onPromptClick: (prompt: string) => void;
  onReset: () => void;
  onSubmit: () => void;
}

export function AssistantTranscript(inputProps: AssistantTranscriptProps) {
  const props = inputProps;

  return (
    <section className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <ConversationPanel {...props} />
      <AssistantRail {...props} />
    </section>
  );
}

function ConversationPanel(inputProps: AssistantTranscriptProps) {
  const { activityControl, errorMessage, messages, onReset } = inputProps;

  return (
    <Card className="min-h-[34rem] w-full">
      <Card.Content className="flex h-full flex-col gap-4 p-4">
        <TranscriptHeader activityControl={activityControl} onReset={onReset} />
        <AssistantWarning message={errorMessage} />
        <TranscriptViewport messages={messages} />
        <ComposerSlot {...inputProps} />
      </Card.Content>
    </Card>
  );
}

function AssistantRail(inputProps: AssistantTranscriptProps) {
  const { connectionStatus, isBusy, onPromptClick, prompts, status } = inputProps;

  return (
    <Card className="w-full">
      <Card.Content className="grid gap-4 p-4">
        <AssistantStatusPanel connectionStatus={connectionStatus} isBusy={isBusy} status={status} />
        <PromptStrip prompts={prompts} onPromptClick={onPromptClick} />
      </Card.Content>
    </Card>
  );
}

function ComposerSlot(inputProps: AssistantTranscriptProps) {
  const { input, isBusy, latestActivity, onInputChange, onSubmit, status } = inputProps;

  return (
    <AssistantComposer
      {...getBusyDetailProp(status, latestActivity)}
      input={input}
      isBusy={isBusy}
      submitLabel={isBusy ? "Calling live tools..." : "Send"}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
    />
  );
}

function getComposerBusyDetail(
  status: AssistantStatus,
  latestActivity: AssistantToolActivity | null,
): string | undefined {
  if (latestActivity?.kind === "tool-call") {
    return `Running ${latestActivity.label} on the Worker.`;
  }

  if (latestActivity?.kind === "tool-result") {
    return `${latestActivity.label} finished. Waiting on the final answer.`;
  }

  return status.phase === "running" ? status.detail : undefined;
}

function getBusyDetailProp(
  status: AssistantStatus,
  latestActivity: AssistantToolActivity | null,
): Record<string, never> | { busyDetail: string } {
  const busyDetail = getComposerBusyDetail(status, latestActivity);
  return busyDetail === undefined ? {} : { busyDetail };
}

function PromptStrip({ onPromptClick, prompts }: PromptStripProps) {
  return (
    <div className="grid gap-2">
      <Text as="h3" className="text-base font-semibold">
        Suggested
      </Text>
      {prompts.map((prompt) => (
        <Button
          key={prompt}
          className="h-auto min-h-9 justify-start whitespace-normal py-2 text-left leading-snug"
          size="sm"
          variant="outline"
          onClick={() => onPromptClick(prompt)}
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
}

interface PromptStripProps {
  onPromptClick: (prompt: string) => void;
  prompts: readonly string[];
}

function TranscriptHeader({ activityControl, onReset }: TranscriptHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Text as="h2" className="text-xl font-semibold leading-tight">
        Conversation
      </Text>
      <div className="flex flex-wrap gap-3">
        {activityControl}
        <Button variant="outline" onClick={onReset}>
          Clear
        </Button>
      </div>
    </div>
  );
}

interface TranscriptHeaderProps {
  activityControl: ReactNode;
  onReset: () => void;
}

function AssistantWarning({ message }: { message: string | null }) {
  return message === null ? null : (
    <Alert status="warning">
      <Alert.Title>Assistant warning</Alert.Title>
      <Alert.Description>{message}</Alert.Description>
    </Alert>
  );
}

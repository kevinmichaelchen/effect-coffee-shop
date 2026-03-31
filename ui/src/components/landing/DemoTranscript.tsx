import { Alert } from "#components/retroui/Alert";
import { Button } from "#components/retroui/Button";
import { Card } from "#components/retroui/Card";
import { DemoStatusPanel } from "#components/landing/DemoStatusPanel";
import { Text } from "#components/retroui/Text";
import { DemoComposer } from "#components/landing/DemoComposer";
import type { DemoCacheStatus, DemoMessage, DemoStatus } from "#hooks/lfmAssistantSupport";

interface DemoTranscriptProps {
  assistantDraft: string;
  cacheStatus: DemoCacheStatus;
  errorMessage: string | null;
  hasLoadedModel: boolean;
  input: string;
  isBusy: boolean;
  messages: readonly DemoMessage[];
  prompts: readonly string[];
  status: DemoStatus;
  onInputChange: (value: string) => void;
  onPromptClick: (prompt: string) => void;
  onReset: () => void;
  onSubmit: () => void;
  onWarmUp: () => void;
}

export function DemoTranscript(inputProps: DemoTranscriptProps) {
  const { assistantDraft, cacheStatus, errorMessage, hasLoadedModel, input, isBusy, messages, onInputChange, onPromptClick, onReset, onSubmit, onWarmUp, prompts, status } = inputProps;

  return (
    <Card className="w-full border-border bg-card">
      <Card.Content className="grid gap-4 p-5">
        <TranscriptHeader onReset={onReset} onWarmUp={onWarmUp} />
        <DemoStatusPanel cacheStatus={cacheStatus} hasLoadedModel={hasLoadedModel} isBusy={isBusy} status={status} />
        {errorMessage !== null ? (
          <Alert status="warning">
            <Alert.Title>Local demo warning</Alert.Title>
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
            <EmptyTranscript cacheStatus={cacheStatus} hasLoadedModel={hasLoadedModel} />
          ) : (
            messages.map((message) => (
              <TranscriptBubble key={message.id} content={message.content} speaker={message.role} />
            ))
          )}
          {assistantDraft !== "" ? <TranscriptBubble content={assistantDraft} speaker="assistant" /> : null}
        </div>
        <DemoComposer
          helpText={getComposerHint(cacheStatus)}
          input={input}
          isBusy={isBusy}
          submitLabel={getComposerLabel(cacheStatus, isBusy)}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
        />
      </Card.Content>
    </Card>
  );
}

interface TranscriptHeaderProps {
  onReset: () => void;
  onWarmUp: () => void;
}

function TranscriptHeader({ onReset, onWarmUp }: TranscriptHeaderProps) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <div className="grid gap-2">
        <Text as="h2" className="text-3xl leading-none md:text-4xl">
          Chat with LFM2.5-350M in your browser.
        </Text>
        <Text as="p" className="max-w-3xl text-sm text-muted-foreground md:text-base">
          The model runs locally over WebGPU and decides when to call the Coffee Shop MCP server
          for live menu, order, and queue actions.
        </Text>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={onWarmUp}>Preload browser model</Button>
        <Button variant="outline" onClick={onReset}>
          Clear transcript
        </Button>
      </div>
    </div>
  );
}

interface EmptyTranscriptProps {
  cacheStatus: DemoCacheStatus;
  hasLoadedModel: boolean;
}

function EmptyTranscript({ cacheStatus, hasLoadedModel }: EmptyTranscriptProps) {
  return (
    <div className="grid content-center gap-3 text-center">
      <Text as="h3" className="text-2xl leading-none">
        No messages yet.
      </Text>
      <Text as="p" className="mx-auto max-w-xl text-sm text-muted-foreground">
        {hasLoadedModel
          ? "The local model is ready in this tab. Ask it to list the menu, place an order, or inspect the queue."
          : cacheStatus.phase === "cold"
          ? "Send a prompt or preload the model. The first run downloads the local browser assets before replying."
          : "Ask it to place an order, inspect the queue, or explain what it just changed in the Coffee Shop backend."}
      </Text>
    </div>
  );
}

interface TranscriptBubbleProps {
  content: string;
  speaker: DemoMessage["role"];
}

function TranscriptBubble({ content, speaker }: TranscriptBubbleProps) {
  const bubbleTone =
    speaker === "assistant"
      ? "border-border bg-card text-card-foreground"
      : "border-black bg-primary text-primary-foreground";
  const labelTone = speaker === "assistant" ? "text-muted-foreground" : "text-primary-foreground/70";

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

function getComposerHint(cacheStatus: DemoCacheStatus): string {
  if (cacheStatus.phase === "cold") {
    return "Cmd/Ctrl + Enter sends the prompt. First use downloads the model.";
  }

  if (cacheStatus.phase === "partial") {
    return "Cmd/Ctrl + Enter sends the prompt. This browser already has part of the model.";
  }

  return "Cmd/Ctrl + Enter sends the prompt.";
}

function getComposerLabel(cacheStatus: DemoCacheStatus, isBusy: boolean): string {
  if (isBusy) {
    return "Running local loop…";
  }

  return cacheStatus.phase === "cold" || cacheStatus.phase === "partial"
    ? "Download + chat"
    : "Send to local model";
}

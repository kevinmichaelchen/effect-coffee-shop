import { Text } from "#shared/ui/retroui/Text.tsx";
import type { AssistantDisplayMessage } from "#features/assistant/lib/assistant-chat.ts";

interface TranscriptViewportProps {
  messages: readonly AssistantDisplayMessage[];
}

export function TranscriptViewport({ messages }: TranscriptViewportProps) {
  return (
    <div className="grid min-h-80 flex-1 content-start gap-3 overflow-y-auto rounded-md border border-border bg-background p-4 pr-3">
      {messages.length === 0 ? <EmptyTranscript /> : <TranscriptMessages messages={messages} />}
    </div>
  );
}

function TranscriptMessages({ messages }: TranscriptViewportProps) {
  return messages.map((message) => (
    <TranscriptBubble key={message.id} content={message.content} speaker={message.role} />
  ));
}

function EmptyTranscript() {
  return (
    <div className="grid content-center gap-3 text-center">
      <Text as="h3" className="text-xl font-semibold leading-tight">
        No messages yet
      </Text>
      <Text as="p" className="mx-auto max-w-xl text-sm text-muted-foreground">
        Ask Beanline to list the menu, place an order, or inspect the queue.
      </Text>
    </div>
  );
}

function TranscriptBubble({ content, speaker }: TranscriptBubbleProps) {
  const bubbleTone = speaker === "assistant" ? "bg-card" : "bg-primary text-primary-foreground";
  const label = speaker === "assistant" ? "Beanline" : "You";

  return (
    <div className={`grid gap-2 rounded-md border border-border p-3 ${bubbleTone}`}>
      <Text as="p" className="text-xs font-medium text-muted-foreground">
        {label}
      </Text>
      <Text as="p" className="text-sm leading-6 whitespace-pre-wrap">
        {content}
      </Text>
    </div>
  );
}

interface TranscriptBubbleProps {
  content: string;
  speaker: AssistantDisplayMessage["role"];
}

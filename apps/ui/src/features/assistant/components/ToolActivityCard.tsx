import { Badge } from "#shared/ui/retroui/Badge.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import type { AssistantToolActivity } from "#features/assistant/lib/assistant-chat.ts";

interface ToolActivityCardProps {
  events: readonly AssistantToolActivity[];
}

export function ToolActivityFeed({ events }: ToolActivityCardProps) {
  return (
    <div className="grid gap-3">
      {events.length === 0 ? (
        <Text as="p" className="text-sm text-muted-foreground">
          No tool calls yet. Ask about menu items, order status, or placing a drink.
        </Text>
      ) : (
        events.map((event, index) => (
          <ToolEventRow
            key={`${event.kind}-${event.label}-${index}`}
            detail={event.detail}
            kind={event.kind}
            label={event.label}
          />
        ))
      )}
    </div>
  );
}

interface ToolEventRowProps {
  detail: string;
  kind: AssistantToolActivity["kind"];
  label: string;
}

function ToolEventRow({ detail, kind, label }: ToolEventRowProps) {
  return (
    <div className="grid gap-2 border-2 border-dashed border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <Text as="p" className="text-sm uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </Text>
        <Badge
          className="rounded-none px-2 py-1"
          size="sm"
          variant={kind === "tool-call" ? "surface" : "solid"}
        >
          {kind === "tool-call" ? "call" : "result"}
        </Badge>
      </div>
      <pre className="font-mono text-xs leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]">
        {detail}
      </pre>
    </div>
  );
}

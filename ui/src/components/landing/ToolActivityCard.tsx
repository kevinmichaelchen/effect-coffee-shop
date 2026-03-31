import { Badge } from "#components/retroui/Badge";
import { Card } from "#components/retroui/Card";
import { Text } from "#components/retroui/Text";
import type { AssistantEvent } from "#lib/assistant-loop";

interface ToolActivityCardProps {
  events: readonly AssistantEvent[];
}

export function ToolActivityCard({ events }: ToolActivityCardProps) {
  return (
    <Card className="w-full border-border bg-card">
      <Card.Content className="grid gap-3 p-5">
        <ToolActivityHeading />
        <ToolActivityFeed events={events} />
      </Card.Content>
    </Card>
  );
}

export function ToolActivityFeed({ events }: ToolActivityCardProps) {
  return (
    <div className="grid gap-3">
      {events.length === 0 ? (
        <Text as="p" className="text-sm text-muted-foreground">
          No MCP calls yet. Ask about menu items, order status, or placing a drink.
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

function ToolActivityHeading() {
  return (
    <Text as="h3" className="text-2xl leading-none">
      Tool activity
    </Text>
  );
}

interface ToolEventRowProps {
  detail: string;
  kind: AssistantEvent["kind"];
  label: string;
}

function ToolEventRow({ detail, kind, label }: ToolEventRowProps) {
  return (
    <div className="grid gap-2 border-2 border-dashed border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <Text as="p" className="text-sm uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </Text>
        <Badge className="rounded-none px-2 py-1" size="sm" variant={kind === "tool-call" ? "surface" : "solid"}>
          {kind === "tool-call" ? "call" : "result"}
        </Badge>
      </div>
      <pre className="font-mono text-xs leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]">
        {detail}
      </pre>
    </div>
  );
}

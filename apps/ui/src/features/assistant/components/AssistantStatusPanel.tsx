import type { ConnectionStatus } from "@tanstack/ai-client";
import { Badge } from "#shared/ui/retroui/Badge.tsx";
import { Spinner } from "#shared/ui/retroui/Spinner.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import type { AssistantStatus } from "#features/assistant/lib/assistant-chat.ts";

interface AssistantStatusPanelProps {
  connectionStatus: ConnectionStatus;
  isBusy: boolean;
  status: AssistantStatus;
}

export function AssistantStatusPanel(inputProps: AssistantStatusPanelProps) {
  const { connectionStatus, isBusy, status } = inputProps;

  return (
    <div className="grid gap-3 border-2 border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            {isBusy ? <Spinner size="sm" /> : null}
            <Text as="p" className="text-sm font-semibold uppercase tracking-[0.08em]">
              {status.label}
            </Text>
          </div>
          <Text as="p" className="max-w-2xl text-sm text-muted-foreground">
            {status.detail}
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-none px-2.5 py-1" size="sm" variant="surface">
            Workers AI
          </Badge>
          <Badge className="rounded-none px-2.5 py-1" size="sm" variant="outline">
            Server tools
          </Badge>
          <Badge
            className="rounded-none px-2.5 py-1"
            size="sm"
            variant={connectionBadgeVariant[connectionStatus]}
          >
            {connectionBadgeLabel[connectionStatus]}
          </Badge>
        </div>
      </div>
    </div>
  );
}

const connectionBadgeLabel = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Idle",
  error: "Connection error",
} as const;

const connectionBadgeVariant = {
  connected: "surface",
  connecting: "outline",
  disconnected: "outline",
  error: "solid",
} as const;

import type { ConnectionStatus } from "@tanstack/ai-client";
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
    <div className="grid gap-3 rounded-md border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        {isBusy ? <Spinner size="sm" /> : null}
        <Text as="h3" className="text-base font-semibold">
          {status.label}
        </Text>
      </div>
      <Text as="p" className="text-sm text-muted-foreground">
        {status.detail}
      </Text>
      <StatusLine label="Connection" value={connectionBadgeLabel[connectionStatus]} />
      <StatusLine label="Tools" value="Server-side" />
    </div>
  );
}

function StatusLine({ label, value }: StatusLineProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

interface StatusLineProps {
  label: string;
  value: string;
}

const connectionBadgeLabel = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Idle",
  error: "Connection error",
} as const;

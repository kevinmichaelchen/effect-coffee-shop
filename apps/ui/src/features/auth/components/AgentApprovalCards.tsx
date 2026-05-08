import { Alert } from "#shared/ui/retroui/Alert.tsx";
import { Button } from "#shared/ui/retroui/Button.tsx";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import type { PendingAgentApproval } from "#features/auth/api/agent-approvals.ts";
import type { ResolutionStatus } from "#features/auth/hooks/useAgentApprovalPage.ts";

function formatExpiresIn(seconds: number): string {
  switch (true) {
    case seconds < 60:
      return `${seconds}s`;
    case seconds < 3_600:
      return `${Math.max(1, Math.floor(seconds / 60))}m`;
    default:
      return `${Math.max(1, Math.floor(seconds / 3_600))}h`;
  }
}

export function AgentApprovalErrorCard({ message, title }: { message: string; title: string }) {
  return (
    <Alert status="warning">
      <Alert.Title>{title}</Alert.Title>
      <Alert.Description>{message}</Alert.Description>
    </Alert>
  );
}

export function ResolutionCard({ status }: { status: Exclude<ResolutionStatus, null> }) {
  const content =
    status === "approved"
      ? {
          description:
            "The agent can now use the granted coffee-ordering capabilities on your behalf.",
          status: "success" as const,
          title: "Capabilities approved",
        }
      : {
          description: "The pending delegated capability request was denied.",
          status: "warning" as const,
          title: "Request denied",
        };

  return (
    <Alert status={content.status}>
      <Alert.Title>{content.title}</Alert.Title>
      <Alert.Description>{content.description}</Alert.Description>
    </Alert>
  );
}

interface PendingApprovalCardProps {
  actionPending: boolean;
  approval: PendingAgentApproval;
  onApprove: () => Promise<void>;
  onDeny: () => Promise<void>;
}

export function PendingApprovalCard(inputProps: PendingApprovalCardProps) {
  const { actionPending, approval, onApprove, onDeny } = inputProps;

  async function handleApprove(): Promise<void> {
    await onApprove();
  }

  async function handleDeny(): Promise<void> {
    await onDeny();
  }

  return (
    <Card className="w-full border-border">
      <Card.Header className="border-b-2 border-border bg-card">
        <Text as="h3">Approve agent access</Text>
        <Text as="p" className="text-sm text-muted-foreground">
          Review the pending delegated capabilities before authorizing this agent.
        </Text>
      </Card.Header>
      <Card.Content className="grid gap-5">
        <div className="grid gap-1">
          <Text as="p" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Agent
          </Text>
          <Text as="h4">{approval.agent_name ?? approval.agent_id ?? "Unknown agent"}</Text>
          <Text as="p" className="text-sm text-muted-foreground">
            Device code expires in {formatExpiresIn(approval.expires_in)}.
          </Text>
        </div>
        {approval.binding_message !== null ? (
          <Alert className="border-border bg-card" status="info">
            <Alert.Title>Binding message</Alert.Title>
            <Alert.Description>{approval.binding_message}</Alert.Description>
          </Alert>
        ) : null}
        <div className="grid gap-2">
          <Text as="h5">Requested capabilities</Text>
          <ul className="grid gap-2">
            {approval.capabilities.map((capability) => (
              <li key={capability} className="border-2 border-border bg-card px-3 py-2 text-sm">
                {capability}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button disabled={actionPending} onClick={handleApprove}>
            Approve capabilities
          </Button>
          <Button disabled={actionPending} variant="outline" onClick={handleDeny}>
            Deny request
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

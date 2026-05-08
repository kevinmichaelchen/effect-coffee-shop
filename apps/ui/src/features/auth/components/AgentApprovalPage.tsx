import { AgentApprovalContent } from "#features/auth/components/AgentApprovalContent.tsx";
import { useAgentApprovalPage } from "#features/auth/hooks/useAgentApprovalPage.ts";

export function AgentApprovalPage() {
  const state = useAgentApprovalPage();

  return <AgentApprovalContent {...state} />;
}

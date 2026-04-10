import type { AgentApprovalPageBodyProps } from "#features/auth/components/AgentApprovalPageBody.tsx";
import { AgentApprovalPageBody } from "#features/auth/components/AgentApprovalPageBody.tsx";

export function AgentApprovalContent(inputProps: AgentApprovalPageBodyProps) {
  return <AgentApprovalPageBody {...inputProps} />;
}

import {
  AgentApprovalErrorCard,
  PendingApprovalCard,
  ResolutionCard,
} from "#features/auth/components/AgentApprovalCards.tsx";
import type { AgentApprovalPageBodyProps } from "#features/auth/components/AgentApprovalPageBody.tsx";

export function ApprovalErrorState({
  approvalError,
  routeError,
}: Pick<AgentApprovalPageBodyProps, "approvalError" | "routeError">) {
  return approvalError === null ? null : (
    <AgentApprovalErrorCard
      message={approvalError}
      title={routeError === null ? "Approval is unavailable" : "Invalid approval link"}
    />
  );
}

export function ResolutionState({
  resolutionStatus,
}: Pick<AgentApprovalPageBodyProps, "resolutionStatus">) {
  return resolutionStatus === null ? null : <ResolutionCard status={resolutionStatus} />;
}

export function MissingRequestState({
  pendingApproval,
  resolutionStatus,
  routeError,
  signedInViewer,
}: Pick<
  AgentApprovalPageBodyProps,
  "pendingApproval" | "resolutionStatus" | "routeError" | "signedInViewer"
>) {
  const requestMissing =
    signedInViewer !== null &&
    routeError === null &&
    resolutionStatus === null &&
    pendingApproval === null;

  return requestMissing ? (
    <AgentApprovalErrorCard
      message="This delegated request is no longer pending for your account."
      title="Request not found"
    />
  ) : null;
}

export function PendingRequestState({
  pendingApproval,
  resolutionMutation,
  resolutionStatus,
  resolvePendingApproval,
  routeError,
  signedInViewer,
}: Pick<
  AgentApprovalPageBodyProps,
  | "pendingApproval"
  | "resolutionMutation"
  | "resolutionStatus"
  | "resolvePendingApproval"
  | "routeError"
  | "signedInViewer"
>) {
  if (signedInViewer === null || routeError !== null || resolutionStatus !== null) {
    return null;
  }

  return pendingApproval === null ? null : (
    <PendingApprovalCard
      actionPending={resolutionMutation.isPending}
      approval={pendingApproval}
      onApprove={async () => resolvePendingApproval("approve")}
      onDeny={async () => resolvePendingApproval("deny")}
    />
  );
}

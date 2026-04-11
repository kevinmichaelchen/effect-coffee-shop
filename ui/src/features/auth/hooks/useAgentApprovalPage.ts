import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPendingAgentApprovals,
  resolveAgentApproval,
  type PendingAgentApproval,
} from "#features/auth/api/agent-approvals.ts";
import { usePasskeyAuth } from "#features/auth/hooks/usePasskeyAuth.ts";
import { useViewerQuery, viewerQueryKey } from "#features/auth/hooks/useViewerQuery.ts";
import { isAuthenticatedViewer, type AuthenticatedViewer } from "#features/auth/lib/viewer.ts";
import { useThemePreference } from "#shared/hooks/useThemePreference.ts";

const pendingAgentApprovalsQueryKey = ["agent-approvals", "pending"] as const;

export type ResolutionStatus = "approved" | "denied" | null;
type PendingAgentApprovals = readonly PendingAgentApproval[];

function readRouteParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

function getRouteContext() {
  return {
    agentId: readRouteParam("agent_id"),
    userCode: readRouteParam("code"),
  };
}

function getRouteError(agentId: string | null, userCode: string | null): string | null {
  return agentId === null || userCode === null
    ? "The approval link is missing the agent identifier or device code."
    : null;
}

function isReviewContextComplete(
  signedInViewer: AuthenticatedViewer | null,
  agentId: string | null,
): boolean {
  return signedInViewer !== null && agentId !== null;
}

function getPendingApproval(
  agentId: string | null,
  approvals: PendingAgentApprovals,
): PendingAgentApproval | null {
  return agentId === null
    ? null
    : (approvals.find((request) => request.agent_id === agentId) ?? null);
}

function getApprovalError(input: {
  approvalsError: string | undefined;
  resolutionError: string | undefined;
  routeError: string | null;
  viewerError: string | undefined;
}): string | null {
  const { approvalsError, resolutionError, routeError, viewerError } = input;
  return routeError ?? viewerError ?? approvalsError ?? resolutionError ?? null;
}

export function useAgentApprovalPage() {
  const { agentId, userCode } = getRouteContext();
  const auth = usePasskeyAuth();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useThemePreference();
  const viewerQuery = useViewerQuery();
  const viewer = viewerQuery.data;
  const signedInViewer = viewer !== undefined && isAuthenticatedViewer(viewer) ? viewer : null;
  const routeError = getRouteError(agentId, userCode);
  const approvalsQuery = useQuery({
    enabled: isReviewContextComplete(signedInViewer, agentId),
    queryFn: fetchPendingAgentApprovals,
    queryKey: pendingAgentApprovalsQueryKey,
    refetchInterval: 5_000,
    staleTime: 1_000,
  });
  const [resolutionStatus, setResolutionStatus] = useState<ResolutionStatus>(null);
  const resolutionMutation = useMutation({
    mutationFn: resolveAgentApproval,
    onSuccess: async (result) => {
      setResolutionStatus(result.status);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pendingAgentApprovalsQueryKey }),
        queryClient.invalidateQueries({ queryKey: viewerQueryKey }),
      ]);
    },
  });
  const pendingApproval = getPendingApproval(agentId, approvalsQuery.data ?? []);
  const approvalError = getApprovalError({
    approvalsError: approvalsQuery.error?.message,
    resolutionError: resolutionMutation.error?.message,
    routeError,
    viewerError: viewerQuery.error?.message,
  });

  async function resolvePendingApproval(action: "approve" | "deny"): Promise<void> {
    if (agentId === null || userCode === null) {
      return;
    }

    await resolutionMutation.mutateAsync({
      action,
      agentId,
      userCode,
    });
  }

  return {
    approvalError,
    approvalsQuery,
    auth,
    pendingApproval,
    resolutionMutation,
    resolutionStatus,
    resolvePendingApproval,
    routeError,
    signedInViewer,
    theme,
    toggleTheme,
  };
}

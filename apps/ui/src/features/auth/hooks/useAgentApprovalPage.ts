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

function useApprovalsQuery(input: {
  agentId: string | null;
  signedInViewer: AuthenticatedViewer | null;
}) {
  const { agentId, signedInViewer } = input;

  return useQuery({
    enabled: isReviewContextComplete(signedInViewer, agentId),
    queryFn: fetchPendingAgentApprovals,
    queryKey: pendingAgentApprovalsQueryKey,
    refetchInterval: 5_000,
    staleTime: 1_000,
  });
}

function useResolutionMutation(setResolutionStatus: (status: ResolutionStatus) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resolveAgentApproval,
    onSuccess: async (result) => {
      setResolutionStatus(result.status);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pendingAgentApprovalsQueryKey }),
        queryClient.invalidateQueries({ queryKey: viewerQueryKey }),
      ]);
    },
  });
}

function createResolvePendingApproval(input: {
  agentId: string | null;
  resolutionMutation: ReturnType<typeof useResolutionMutation>;
  userCode: string | null;
}) {
  const { agentId, resolutionMutation, userCode } = input;

  return async function resolvePendingApproval(action: "approve" | "deny"): Promise<void> {
    if (agentId === null || userCode === null) {
      return;
    }

    await resolutionMutation.mutateAsync({ action, agentId, userCode });
  };
}

function getSignedInViewer(viewer: ReturnType<typeof useViewerQuery>["data"]) {
  return viewer !== undefined && isAuthenticatedViewer(viewer) ? viewer : null;
}

function useApprovalResolution(agentId: string | null, userCode: string | null) {
  const [resolutionStatus, setResolutionStatus] = useState<ResolutionStatus>(null);
  const resolutionMutation = useResolutionMutation(setResolutionStatus);
  const resolvePendingApproval = createResolvePendingApproval({
    agentId,
    resolutionMutation,
    userCode,
  });

  return { resolutionMutation, resolutionStatus, resolvePendingApproval };
}

export function useAgentApprovalPage() {
  const { agentId, userCode } = getRouteContext();
  const auth = usePasskeyAuth();
  const { theme, toggleTheme } = useThemePreference();
  const viewerQuery = useViewerQuery();
  const signedInViewer = getSignedInViewer(viewerQuery.data);
  const routeError = getRouteError(agentId, userCode);
  const approvalsQuery = useApprovalsQuery({ agentId, signedInViewer });
  const { resolutionMutation, resolutionStatus, resolvePendingApproval } = useApprovalResolution(
    agentId,
    userCode,
  );
  const pendingApproval = getPendingApproval(agentId, approvalsQuery.data ?? []);
  const approvalError = getApprovalError({
    approvalsError: approvalsQuery.error?.message,
    resolutionError: resolutionMutation.error?.message,
    routeError,
    viewerError: viewerQuery.error?.message,
  });

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

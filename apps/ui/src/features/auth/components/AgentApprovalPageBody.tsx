import { appRoutes } from "#app/routes.ts";
import {
  ApprovalErrorState,
  MissingRequestState,
  PendingRequestState,
  ResolutionState,
} from "#features/auth/components/AgentApprovalStates.tsx";
import { PasskeyGateCard } from "#features/auth/components/PasskeyGateCard.tsx";
import { SessionCard } from "#features/auth/components/SessionCard.tsx";
import type { PendingAgentApproval } from "#features/auth/api/agent-approvals.ts";
import type { AuthenticatedViewer } from "#features/auth/lib/viewer.ts";
import { PageHeader } from "#features/coffee-shop/components/PageHeader.tsx";
import type { ResolutionStatus } from "#features/auth/hooks/useAgentApprovalPage.ts";
import type { ThemePreference } from "#shared/hooks/useThemePreference.ts";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";

const approvalNavLinks = [
  { href: appRoutes.home, label: "Assistant", variant: "outline" as const },
  { href: appRoutes.shop, label: "Customer workspace", variant: "outline" as const },
];

export interface AgentApprovalPageBodyProps {
  approvalError: string | null;
  auth: {
    createAccount: () => Promise<void>;
    displayName: string;
    errorMessage: string | null;
    isPending: boolean;
    pendingAction: "create-account" | "sign-in" | "sign-out" | null;
    setDisplayName: (value: string) => void;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
  };
  pendingApproval: PendingAgentApproval | null;
  resolutionMutation: {
    isPending: boolean;
  };
  resolutionStatus: ResolutionStatus;
  resolvePendingApproval: (action: "approve" | "deny") => Promise<void>;
  routeError: string | null;
  signedInViewer: AuthenticatedViewer | null;
  theme: ThemePreference;
  toggleTheme: () => void;
}

function AgentApprovalIntro({
  auth,
  signedInViewer,
}: Pick<AgentApprovalPageBodyProps, "auth" | "signedInViewer">) {
  return signedInViewer !== null ? (
    <SessionCard isPending={auth.isPending} viewer={signedInViewer} onSignOut={auth.signOut} />
  ) : (
    <PasskeyGateCard
      description="Use your passkey-linked account to review and approve the requested agent capabilities."
      displayName={auth.displayName}
      errorMessage={auth.errorMessage}
      isPending={auth.isPending}
      pendingAction={auth.pendingAction}
      title="Sign in to continue"
      onCreateAccount={auth.createAccount}
      onDisplayNameChange={auth.setDisplayName}
      onSignIn={auth.signIn}
    />
  );
}

function AgentApprovalPanel(inputProps: Omit<AgentApprovalPageBodyProps, "theme" | "toggleTheme">) {
  const {
    approvalError,
    auth,
    pendingApproval,
    resolutionMutation,
    resolutionStatus,
    resolvePendingApproval,
    routeError,
    signedInViewer,
  } = inputProps;

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <Card.Header className="border-b border-border">
        <Text as="h3">Authorize agent</Text>
        <Text as="p" className="text-sm text-muted-foreground">
          Review delegated capabilities before approving this device.
        </Text>
      </Card.Header>
      <Card.Content className="grid gap-5">
        <AgentApprovalIntro auth={auth} signedInViewer={signedInViewer} />
        <ApprovalErrorState approvalError={approvalError} routeError={routeError} />
        <ResolutionState resolutionStatus={resolutionStatus} />
        <MissingRequestState
          pendingApproval={pendingApproval}
          resolutionStatus={resolutionStatus}
          routeError={routeError}
          signedInViewer={signedInViewer}
        />
        <PendingRequestState
          pendingApproval={pendingApproval}
          resolutionMutation={resolutionMutation}
          resolutionStatus={resolutionStatus}
          resolvePendingApproval={resolvePendingApproval}
          routeError={routeError}
          signedInViewer={signedInViewer}
        />
      </Card.Content>
    </Card>
  );
}

export function AgentApprovalPageBody(inputProps: AgentApprovalPageBodyProps) {
  const {
    approvalError,
    auth,
    pendingApproval,
    resolutionMutation,
    resolutionStatus,
    resolvePendingApproval,
    routeError,
    signedInViewer,
    theme,
    toggleTheme,
  } = inputProps;

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-5xl gap-5 px-4 py-5 lg:px-6">
      <PageHeader
        activeOrders={0}
        badgeLabel="Agent approval"
        footerLabel="Delegated Better Auth capability review"
        navLinks={approvalNavLinks}
        theme={theme}
        title="Approve agent capabilities"
        totalOrders={0}
        onToggleTheme={toggleTheme}
      />
      <AgentApprovalPanel
        approvalError={approvalError}
        auth={auth}
        pendingApproval={pendingApproval}
        resolutionMutation={resolutionMutation}
        resolutionStatus={resolutionStatus}
        resolvePendingApproval={resolvePendingApproval}
        routeError={routeError}
        signedInViewer={signedInViewer}
      />
    </main>
  );
}

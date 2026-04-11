import { Alert } from "#shared/ui/retroui/Alert.tsx";
import { HeroBanner } from "#features/coffee-shop/components/HeroBanner.tsx";
import { PageHeader } from "#features/coffee-shop/components/PageHeader.tsx";
import { BaristaPanel } from "#features/coffee-shop/components/barista/BaristaPanel.tsx";
import { useStaffWorkspace } from "#features/coffee-shop/hooks/useStaffWorkspace.ts";
import { usePasskeyAuth } from "#features/auth/hooks/usePasskeyAuth.ts";
import { PasskeyGateCard } from "#features/auth/components/PasskeyGateCard.tsx";
import { SessionCard } from "#features/auth/components/SessionCard.tsx";
import { appRoutes } from "#app/routes.ts";
import {
  isAuthenticatedViewer,
  isStaffViewer,
  type AuthenticatedViewer,
} from "#features/auth/lib/viewer.ts";

function getHeaderLinks() {
  return [
    { href: appRoutes.home, label: "Beanline Assistant", variant: "outline" as const },
    { href: appRoutes.shop, label: "Customer workspace", variant: "outline" as const },
  ];
}

function WorkspaceWarning({ message }: { message: string }) {
  return (
    <Alert status="warning">
      <Alert.Title>Workspace warning</Alert.Title>
      <Alert.Description>{message}</Alert.Description>
    </Alert>
  );
}

function StaffAccessWarning() {
  return (
    <Alert status="warning">
      <Alert.Title>Staff access required</Alert.Title>
      <Alert.Description>
        This account can place orders, but it is not on the staff allowlist for queue actions.
      </Alert.Description>
    </Alert>
  );
}

function StaffAuthGate(inputProps: {
  auth: ReturnType<typeof usePasskeyAuth>;
  viewer: AuthenticatedViewer | null;
}) {
  const { auth, viewer } = inputProps;

  return viewer !== null ? (
    <SessionCard isPending={auth.isPending} viewer={viewer} onSignOut={auth.signOut} />
  ) : (
    <PasskeyGateCard
      description="Only staff-listed accounts can manage the live queue."
      displayName={auth.displayName}
      errorMessage={auth.errorMessage}
      isPending={auth.isPending}
      pendingAction={auth.pendingAction}
      title="Sign in with your staff passkey"
      onCreateAccount={auth.createAccount}
      onDisplayNameChange={auth.setDisplayName}
      onSignIn={auth.signIn}
    />
  );
}

function StaffQueuePanel(inputProps: {
  activeOrders: ReturnType<typeof useStaffWorkspace>["activeOrders"];
  handleOrderAction: ReturnType<typeof useStaffWorkspace>["handleOrderAction"];
  historyOrders: ReturnType<typeof useStaffWorkspace>["historyOrders"];
  pendingOrderId: ReturnType<typeof useStaffWorkspace>["pendingOrderId"];
  queueLoad: ReturnType<typeof useStaffWorkspace>["queueLoad"];
  readyCount: ReturnType<typeof useStaffWorkspace>["readyCount"];
  selectedOrder: ReturnType<typeof useStaffWorkspace>["selectedOrder"];
  setSelectedOrderId: ReturnType<typeof useStaffWorkspace>["setSelectedOrderId"];
}) {
  const {
    activeOrders,
    handleOrderAction,
    historyOrders,
    pendingOrderId,
    queueLoad,
    readyCount,
    selectedOrder,
    setSelectedOrderId,
  } = inputProps;

  return (
    <BaristaPanel
      activeOrders={activeOrders}
      historyOrders={historyOrders.slice(0, 6)}
      pendingOrderId={pendingOrderId}
      queueLoad={queueLoad}
      readyCount={readyCount}
      selectedOrder={selectedOrder}
      onAction={handleOrderAction}
      onInspect={setSelectedOrderId}
      onOpenChange={(open) => !open && setSelectedOrderId(null)}
    />
  );
}

function StaffWorkspaceView(inputProps: {
  auth: ReturnType<typeof usePasskeyAuth>;
  workspace: ReturnType<typeof useStaffWorkspace>;
}) {
  const { auth, workspace } = inputProps;
  const signedInViewer = isAuthenticatedViewer(workspace.viewer) ? workspace.viewer : null;
  const isStaffSession = signedInViewer !== null && isStaffViewer(signedInViewer);

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 py-4 lg:px-6">
      <PageHeader
        activeOrders={workspace.activeOrders.length}
        badgeLabel="Coffee shop"
        footerLabel="Staff-only queue management"
        navLinks={getHeaderLinks()}
        theme={workspace.theme}
        title="Staff workspace"
        totalOrders={workspace.orders.length}
        onToggleTheme={workspace.toggleTheme}
      />
      <HeroBanner
        badgeLabel="Queue operations"
        description="This side of the workspace can move tickets through brewing, ready, pickup, and cancellation without exposing customer ordering controls."
        isRefreshingText={
          workspace.ordersQuery.isFetching
            ? "Refreshing the queue…"
            : "Queue synced with the live HTTP API."
        }
        metrics={[
          { label: "Active orders", value: String(workspace.activeOrders.length) },
          { label: "Ready now", value: String(workspace.readyCount) },
          { label: "Recent history", value: String(workspace.historyOrders.length) },
        ]}
        queueLoad={workspace.queueLoad}
        title="Run the line without seeing the customer composer."
      />
      {workspace.errorMessage !== null ? (
        <WorkspaceWarning message={workspace.errorMessage} />
      ) : null}
      <StaffAuthGate auth={auth} viewer={signedInViewer} />
      {signedInViewer !== null && !isStaffSession ? <StaffAccessWarning /> : null}
      {isStaffSession ? (
        <StaffQueuePanel
          activeOrders={workspace.activeOrders}
          handleOrderAction={workspace.handleOrderAction}
          historyOrders={workspace.historyOrders}
          pendingOrderId={workspace.pendingOrderId}
          queueLoad={workspace.queueLoad}
          readyCount={workspace.readyCount}
          selectedOrder={workspace.selectedOrder}
          setSelectedOrderId={workspace.setSelectedOrderId}
        />
      ) : null}
    </main>
  );
}

export function CoffeeStaffPage() {
  const workspace = useStaffWorkspace();
  const auth = usePasskeyAuth();

  return <StaffWorkspaceView auth={auth} workspace={workspace} />;
}

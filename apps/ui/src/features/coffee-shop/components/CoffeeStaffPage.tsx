import {
  WorkspaceAuthGate,
  WorkspaceHeader,
  WorkspaceWarning,
} from "#features/coffee-shop/components/CoffeeWorkspaceShell.tsx";
import { getCoffeeHeaderLinks } from "#features/coffee-shop/components/CoffeeWorkspaceLinks.ts";
import { WorkspaceMetricStrip } from "#features/coffee-shop/components/WorkspaceMetricStrip.tsx";
import { BaristaPanel } from "#features/coffee-shop/components/barista/BaristaPanel.tsx";
import { useStaffWorkspace } from "#features/coffee-shop/hooks/useStaffWorkspace.ts";
import { usePasskeyAuth } from "#features/auth/hooks/usePasskeyAuth.ts";
import {
  isAuthenticatedViewer,
  isStaffViewer,
  type AuthenticatedViewer,
} from "#features/auth/lib/viewer.ts";
import { Alert } from "#shared/ui/retroui/Alert.tsx";

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

  return (
    <WorkspaceAuthGate
      auth={auth}
      description="Only staff-listed accounts can manage the live queue."
      title="Sign in with your staff passkey"
      viewer={viewer}
    />
  );
}

function StaffQueuePanel(inputProps: {
  activeOrders: ReturnType<typeof useStaffWorkspace>["activeOrders"];
  handleOrderAction: ReturnType<typeof useStaffWorkspace>["handleOrderAction"];
  historyOrders: ReturnType<typeof useStaffWorkspace>["historyOrders"];
  pendingOrderId: ReturnType<typeof useStaffWorkspace>["pendingOrderId"];
  selectedOrder: ReturnType<typeof useStaffWorkspace>["selectedOrder"];
  setSelectedOrderId: ReturnType<typeof useStaffWorkspace>["setSelectedOrderId"];
}) {
  const {
    activeOrders,
    handleOrderAction,
    historyOrders,
    pendingOrderId,
    selectedOrder,
    setSelectedOrderId,
  } = inputProps;

  return (
    <BaristaPanel
      activeOrders={activeOrders}
      historyOrders={historyOrders.slice(0, 6)}
      pendingOrderId={pendingOrderId}
      selectedOrder={selectedOrder}
      onAction={handleOrderAction}
      onInspect={setSelectedOrderId}
      onOpenChange={(open) => !open && setSelectedOrderId(null)}
    />
  );
}

function StaffMetricStrip(inputProps: {
  active: number;
  history: number;
  load: number;
  ready: number;
}) {
  const { active, history, load, ready } = inputProps;

  return (
    <WorkspaceMetricStrip
      metrics={[
        { label: "Active", value: String(active) },
        { label: "Ready", value: String(ready) },
        { label: "History", value: String(history) },
        { label: "Load", progress: load, value: `${load}%` },
      ]}
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
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 py-5 lg:px-6">
      <StaffWorkspaceHeader workspace={workspace} />
      <WorkspaceWarning message={workspace.errorMessage} />
      <StaffAuthGate auth={auth} viewer={signedInViewer} />
      <StaffWorkspaceAccess isStaffSession={isStaffSession} signedInViewer={signedInViewer} />
      <StaffSignedInWorkspace isStaffSession={isStaffSession} workspace={workspace} />
    </main>
  );
}

function StaffWorkspaceHeader(inputProps: { workspace: ReturnType<typeof useStaffWorkspace> }) {
  const { workspace } = inputProps;

  return (
    <WorkspaceHeader
      activeOrders={workspace.activeOrders.length}
      footerLabel="Staff-only queue management"
      navLinks={getCoffeeHeaderLinks("shop")}
      theme={workspace.theme}
      title="Staff workspace"
      totalOrders={workspace.orders.length}
      onToggleTheme={workspace.toggleTheme}
    >
      <StaffMetricStrip
        active={workspace.activeOrders.length}
        history={workspace.historyOrders.length}
        load={workspace.queueLoad}
        ready={workspace.readyCount}
      />
    </WorkspaceHeader>
  );
}

function StaffWorkspaceAccess(inputProps: {
  isStaffSession: boolean;
  signedInViewer: AuthenticatedViewer | null;
}) {
  const { isStaffSession, signedInViewer } = inputProps;

  return signedInViewer !== null && !isStaffSession ? <StaffAccessWarning /> : null;
}

function StaffSignedInWorkspace(inputProps: {
  isStaffSession: boolean;
  workspace: ReturnType<typeof useStaffWorkspace>;
}) {
  const { isStaffSession, workspace } = inputProps;

  return isStaffSession ? (
    <StaffQueuePanel
      activeOrders={workspace.activeOrders}
      handleOrderAction={workspace.handleOrderAction}
      historyOrders={workspace.historyOrders}
      pendingOrderId={workspace.pendingOrderId}
      selectedOrder={workspace.selectedOrder}
      setSelectedOrderId={workspace.setSelectedOrderId}
    />
  ) : null;
}

export function CoffeeStaffPage() {
  const workspace = useStaffWorkspace();
  const auth = usePasskeyAuth();

  return <StaffWorkspaceView auth={auth} workspace={workspace} />;
}

import {
  WorkspaceAuthGate,
  WorkspaceHeader,
  WorkspaceWarning,
} from "#features/coffee-shop/components/CoffeeWorkspaceShell.tsx";
import { getCoffeeHeaderLinks } from "#features/coffee-shop/components/CoffeeWorkspaceLinks.ts";
import { ReceiptDialog } from "#features/coffee-shop/components/ReceiptDialog.tsx";
import { WorkspaceMetricStrip } from "#features/coffee-shop/components/WorkspaceMetricStrip.tsx";
import { CustomerPanel } from "#features/coffee-shop/components/customer/CustomerPanel.tsx";
import { CustomerOrdersPanel } from "#features/coffee-shop/components/customer/CustomerOrdersPanel.tsx";
import { useCustomerWorkspace } from "#features/coffee-shop/hooks/useCustomerWorkspace.ts";
import { usePasskeyAuth } from "#features/auth/hooks/usePasskeyAuth.ts";
import { isAuthenticatedViewer, type AuthenticatedViewer } from "#features/auth/lib/viewer.ts";

function openOrdersSection(): void {
  document.getElementById("my-orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function CustomerAuthGate(inputProps: {
  auth: ReturnType<typeof usePasskeyAuth>;
  viewer: AuthenticatedViewer | null;
}) {
  const { auth, viewer } = inputProps;

  return (
    <WorkspaceAuthGate
      auth={auth}
      description="Create a customer account with one passkey, then come back with a single tap."
      title="Sign in before placing an order"
      viewer={viewer}
    />
  );
}

function CustomerWorkspacePanels(inputProps: {
  activeOrders: ReturnType<typeof useCustomerWorkspace>["activeOrders"];
  createOrderMutation: ReturnType<typeof useCustomerWorkspace>["createOrderMutation"];
  draftState: ReturnType<typeof useCustomerWorkspace>["draftState"];
  historyOrders: ReturnType<typeof useCustomerWorkspace>["historyOrders"];
  menu: ReturnType<typeof useCustomerWorkspace>["menu"];
  ordersQuery: ReturnType<typeof useCustomerWorkspace>["ordersQuery"];
  submitOrder: ReturnType<typeof useCustomerWorkspace>["submitOrder"];
}) {
  const {
    activeOrders,
    createOrderMutation,
    draftState,
    historyOrders,
    menu,
    ordersQuery,
    submitOrder,
  } = inputProps;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <CustomerPanel
        draft={draftState.draft}
        menu={menu}
        pending={createOrderMutation.isPending}
        priceCents={draftState.priceCents}
        selectedItem={draftState.selectedItem}
        onSelectDrink={draftState.selectDrink}
        onSubmit={submitOrder}
        onUpdateDraft={draftState.updateDraft}
      />
      <div id="my-orders">
        <CustomerOrdersPanel
          activeOrders={activeOrders}
          historyOrders={historyOrders}
          isRefreshing={ordersQuery.isFetching}
        />
      </div>
    </div>
  );
}

function CustomerMetricStrip(inputProps: { active: number; history: number; menu: number }) {
  const { active, history, menu } = inputProps;

  return (
    <WorkspaceMetricStrip
      metrics={[
        { label: "Menu", value: String(menu) },
        { label: "Active", value: String(active) },
        { label: "History", value: String(history) },
      ]}
    />
  );
}

function CustomerWorkspaceView(inputProps: {
  auth: ReturnType<typeof usePasskeyAuth>;
  workspace: ReturnType<typeof useCustomerWorkspace>;
}) {
  const { auth, workspace } = inputProps;
  const signedInViewer = isAuthenticatedViewer(workspace.viewer) ? workspace.viewer : null;

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 py-5 lg:px-6">
      <CustomerWorkspaceHeader workspace={workspace} />
      <WorkspaceWarning message={workspace.errorMessage} />
      <CustomerAuthGate auth={auth} viewer={signedInViewer} />
      <CustomerSignedInWorkspace signedInViewer={signedInViewer} workspace={workspace} />
      <ReceiptDialog
        actionLabel="Open my orders"
        order={workspace.receiptOrder}
        onClose={() => workspace.setReceiptOrder(null)}
        onOpenOrders={openOrdersSection}
      />
    </main>
  );
}

function CustomerWorkspaceHeader(inputProps: {
  workspace: ReturnType<typeof useCustomerWorkspace>;
}) {
  const { workspace } = inputProps;

  return (
    <WorkspaceHeader
      activeOrders={workspace.activeOrders.length}
      footerLabel="Order for yourself with passkey-scoped tickets"
      navLinks={getCoffeeHeaderLinks("staff")}
      theme={workspace.theme}
      title="Customer workspace"
      totalOrders={workspace.orders.length}
      onToggleTheme={workspace.toggleTheme}
    >
      <CustomerMetricStrip
        active={workspace.activeOrders.length}
        history={workspace.historyOrders.length}
        menu={workspace.menu.length}
      />
    </WorkspaceHeader>
  );
}

function CustomerSignedInWorkspace(inputProps: {
  signedInViewer: AuthenticatedViewer | null;
  workspace: ReturnType<typeof useCustomerWorkspace>;
}) {
  const { signedInViewer, workspace } = inputProps;

  return signedInViewer === null ? null : (
    <CustomerWorkspacePanels
      activeOrders={workspace.activeOrders}
      createOrderMutation={workspace.createOrderMutation}
      draftState={workspace.draftState}
      historyOrders={workspace.historyOrders}
      menu={workspace.menu}
      ordersQuery={workspace.ordersQuery}
      submitOrder={workspace.submitOrder}
    />
  );
}

export function CoffeeCustomerPage() {
  const workspace = useCustomerWorkspace();
  const auth = usePasskeyAuth();

  return <CustomerWorkspaceView auth={auth} workspace={workspace} />;
}

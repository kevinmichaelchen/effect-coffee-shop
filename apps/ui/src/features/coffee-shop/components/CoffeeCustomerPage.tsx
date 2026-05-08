import { Alert } from "#shared/ui/retroui/Alert.tsx";
import { HeroBanner } from "#features/coffee-shop/components/HeroBanner.tsx";
import { PageHeader } from "#features/coffee-shop/components/PageHeader.tsx";
import { ReceiptDialog } from "#features/coffee-shop/components/ReceiptDialog.tsx";
import { CustomerPanel } from "#features/coffee-shop/components/customer/CustomerPanel.tsx";
import { CustomerOrdersPanel } from "#features/coffee-shop/components/customer/CustomerOrdersPanel.tsx";
import { useCustomerWorkspace } from "#features/coffee-shop/hooks/useCustomerWorkspace.ts";
import { usePasskeyAuth } from "#features/auth/hooks/usePasskeyAuth.ts";
import { PasskeyGateCard } from "#features/auth/components/PasskeyGateCard.tsx";
import { SessionCard } from "#features/auth/components/SessionCard.tsx";
import { appRoutes } from "#app/routes.ts";
import { isAuthenticatedViewer, type AuthenticatedViewer } from "#features/auth/lib/viewer.ts";
import { getQueueLoad } from "#features/coffee-shop/lib/coffee.ts";

function openOrdersSection(): void {
  document.getElementById("my-orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getHeaderLinks() {
  return [
    { href: appRoutes.home, label: "Beanline Assistant", variant: "outline" as const },
    { href: appRoutes.staff, label: "Staff queue", variant: "outline" as const },
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

function CustomerAuthGate(inputProps: {
  auth: ReturnType<typeof usePasskeyAuth>;
  viewer: AuthenticatedViewer | null;
}) {
  const { auth, viewer } = inputProps;

  return viewer !== null ? (
    <SessionCard isPending={auth.isPending} viewer={viewer} onSignOut={auth.signOut} />
  ) : (
    <PasskeyGateCard
      description="Create a customer account with one passkey, then come back with a single tap."
      displayName={auth.displayName}
      errorMessage={auth.errorMessage}
      isPending={auth.isPending}
      pendingAction={auth.pendingAction}
      title="Sign in before placing an order"
      onCreateAccount={auth.createAccount}
      onDisplayNameChange={auth.setDisplayName}
      onSignIn={auth.signIn}
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
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

function CustomerWorkspaceView(inputProps: {
  auth: ReturnType<typeof usePasskeyAuth>;
  workspace: ReturnType<typeof useCustomerWorkspace>;
}) {
  const { auth, workspace } = inputProps;
  const signedInViewer = isAuthenticatedViewer(workspace.viewer) ? workspace.viewer : null;

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 py-4 lg:px-6">
      <PageHeader
        activeOrders={workspace.activeOrders.length}
        badgeLabel="Coffee shop"
        footerLabel="Order for yourself with passkey-scoped tickets"
        navLinks={getHeaderLinks()}
        theme={workspace.theme}
        title="Customer workspace"
        totalOrders={workspace.orders.length}
        onToggleTheme={workspace.toggleTheme}
      />
      <HeroBanner
        badgeLabel="Passkey + D1"
        description="Your order history is scoped to your account, while the same D1-backed queue still powers the staff side."
        isRefreshingText={
          workspace.ordersQuery.isFetching
            ? "Refreshing your tickets…"
            : "Your tickets are synced with the live HTTP API."
        }
        metrics={[
          { label: "Menu items", value: String(workspace.menu.length) },
          { label: "Active orders", value: String(workspace.activeOrders.length) },
          { label: "History", value: String(workspace.historyOrders.length) },
        ]}
        queueLoad={getQueueLoad(workspace.activeOrders.length)}
        title="Place an order without seeing anyone else’s."
      />
      {workspace.errorMessage !== null ? (
        <WorkspaceWarning message={workspace.errorMessage} />
      ) : null}
      <CustomerAuthGate auth={auth} viewer={signedInViewer} />
      {signedInViewer !== null ? (
        <CustomerWorkspacePanels
          activeOrders={workspace.activeOrders}
          createOrderMutation={workspace.createOrderMutation}
          draftState={workspace.draftState}
          historyOrders={workspace.historyOrders}
          menu={workspace.menu}
          ordersQuery={workspace.ordersQuery}
          submitOrder={workspace.submitOrder}
        />
      ) : null}
      <ReceiptDialog
        actionLabel="Open my orders"
        order={workspace.receiptOrder}
        onClose={() => workspace.setReceiptOrder(null)}
        onOpenOrders={openOrdersSection}
      />
    </main>
  );
}

export function CoffeeCustomerPage() {
  const workspace = useCustomerWorkspace();
  const auth = usePasskeyAuth();

  return <CustomerWorkspaceView auth={auth} workspace={workspace} />;
}

import { CoffeeShopLayout } from "#features/coffee-shop/components/CoffeeShopLayout.tsx";
import { BaristaPanel } from "#features/coffee-shop/components/barista/BaristaPanel.tsx";
import { CustomerPanel } from "#features/coffee-shop/components/customer/CustomerPanel.tsx";
import { useCoffeeShopState } from "#features/coffee-shop/hooks/useCoffeeShopState.ts";

export function CoffeeShopPage() {
  const state = useCoffeeShopState();
  const {
    actions,
    createOrderMutation,
    draftState,
    errorMessage,
    menu,
    menuCount,
    orders,
    ordersQuery,
    queue,
    theme,
    toggleTheme,
    workspace,
  } = state;

  return (
    <CoffeeShopLayout
      activeOrders={queue.activeOrders.length}
      baristaPanel={
        <BaristaPanel
          activeOrders={queue.activeOrders}
          historyOrders={queue.historyOrders.slice(0, 4)}
          pendingOrderId={queue.pendingOrderId}
          queueLoad={queue.queueLoad}
          readyCount={queue.readyCount}
          selectedOrder={queue.selectedOrder}
          onAction={actions.handleOrderAction}
          onInspect={workspace.setSelectedOrderId}
          onOpenChange={(open) => !open && workspace.setSelectedOrderId(null)}
        />
      }
      customerPanel={
        <CustomerPanel
          draft={draftState.draft}
          menu={menu}
          pending={createOrderMutation.isPending}
          priceCents={draftState.priceCents}
          selectedItem={draftState.selectedItem}
          onSelectDrink={draftState.selectDrink}
          onSubmit={actions.handleSubmit}
          onUpdateDraft={draftState.updateDraft}
        />
      }
      errorMessage={errorMessage}
      isRefreshing={ordersQuery.isFetching}
      menuCount={menuCount}
      queueLoad={queue.queueLoad}
      receiptOrder={workspace.receiptOrder}
      theme={theme}
      totalOrders={orders.length}
      viewMode={workspace.viewMode}
      onCloseReceipt={() => workspace.setReceiptOrder(null)}
      onShowQueue={() => workspace.setViewMode("barista")}
      onToggleTheme={toggleTheme}
      onViewModeChange={workspace.setViewMode}
    />
  );
}

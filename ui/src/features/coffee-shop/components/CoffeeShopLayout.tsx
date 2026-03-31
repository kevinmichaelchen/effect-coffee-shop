import type { ReactNode } from "react";
import { Alert } from "#shared/ui/retroui/Alert.tsx";
import { HeroBanner } from "#features/coffee-shop/components/HeroBanner.tsx";
import { PageHeader } from "#features/coffee-shop/components/PageHeader.tsx";
import { ReceiptDialog } from "#features/coffee-shop/components/ReceiptDialog.tsx";
import { ViewModeTabs } from "#features/coffee-shop/components/ViewModeTabs.tsx";
import type { ViewMode } from "#features/coffee-shop/components/view-mode.ts";
import type { ThemePreference } from "#shared/hooks/useThemePreference.ts";
import type { CoffeeOrder } from "#features/coffee-shop/lib/coffee.ts";

interface CoffeeShopLayoutProps {
  activeOrders: number;
  baristaPanel: ReactNode;
  customerPanel: ReactNode;
  errorMessage: string | null;
  isRefreshing: boolean;
  menuCount: number;
  queueLoad: number;
  receiptOrder: CoffeeOrder | null;
  theme: ThemePreference;
  totalOrders: number;
  viewMode: ViewMode;
  onCloseReceipt: () => void;
  onShowQueue: () => void;
  onToggleTheme: () => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export function CoffeeShopLayout(inputProps: CoffeeShopLayoutProps) {
  const {
    activeOrders,
    baristaPanel,
    customerPanel,
    errorMessage,
    isRefreshing,
    menuCount,
    queueLoad,
    receiptOrder,
    theme,
    totalOrders,
    viewMode,
    onCloseReceipt,
    onShowQueue,
    onToggleTheme,
    onViewModeChange,
  } = inputProps;

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 py-4 lg:px-6">
      <PageHeader
        activeOrders={activeOrders}
        theme={theme}
        totalOrders={totalOrders}
        onToggleTheme={onToggleTheme}
      />
      <HeroBanner
        activeOrders={activeOrders}
        isRefreshing={isRefreshing}
        menuCount={menuCount}
        queueLoad={queueLoad}
      />
      {errorMessage !== null ? (
        <Alert status="warning">
          <Alert.Title>Backend warning</Alert.Title>
          <Alert.Description>{errorMessage}</Alert.Description>
        </Alert>
      ) : null}
      <ViewModeTabs
        baristaPanel={baristaPanel}
        customerPanel={customerPanel}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />
      <ReceiptDialog order={receiptOrder} onClose={onCloseReceipt} onShowQueue={onShowQueue} />
    </main>
  );
}

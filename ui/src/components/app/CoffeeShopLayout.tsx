import type { ReactNode } from "react";
import { Alert } from "#components/retroui/Alert";
import { HeroBanner } from "#components/app/HeroBanner";
import { PageHeader } from "#components/app/PageHeader";
import { ReceiptDialog } from "#components/app/ReceiptDialog";
import { ViewModeTabs } from "#components/app/ViewModeTabs";
import type { ViewMode } from "#components/app/view-mode";
import type { ThemePreference } from "#hooks/useThemePreference";
import type { CoffeeOrder } from "#lib/coffee";

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

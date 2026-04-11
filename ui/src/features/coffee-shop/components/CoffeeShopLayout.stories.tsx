import type { Meta, StoryObj } from "@storybook/react-vite";
import { CoffeeShopLayout } from "#features/coffee-shop/components/CoffeeShopLayout.tsx";
import { BaristaPanel } from "#features/coffee-shop/components/barista/BaristaPanel.tsx";
import { CustomerPanel } from "#features/coffee-shop/components/customer/CustomerPanel.tsx";
import {
  storyActiveOrders,
  storyDraft,
  storyHistoryOrders,
  storyMenu,
  storyPriceCents,
  storyQueueLoad,
  storyReceiptOrder,
  storySelectedItem,
  storySelectedOrder,
} from "#features/coffee-shop/components/coffeeShopStoryData.ts";

const meta = {
  title: "Coffee Shop/Screens/ControlRoom",
  component: CoffeeShopLayout,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    activeOrders: storyActiveOrders.length,
    baristaPanel: null,
    customerPanel: null,
    errorMessage: null,
    isRefreshing: false,
    menuCount: storyMenu.length,
    queueLoad: storyQueueLoad,
    receiptOrder: null,
    theme: "light",
    totalOrders: storyActiveOrders.length + storyHistoryOrders.length,
    viewMode: "dual",
    onCloseReceipt: () => {},
    onShowQueue: () => {},
    onToggleTheme: () => {},
    onViewModeChange: () => {},
  },
  render: (args) => (
    <CoffeeShopLayout
      {...args}
      baristaPanel={
        <BaristaPanel
          activeOrders={storyActiveOrders}
          historyOrders={storyHistoryOrders}
          pendingOrderId={storyActiveOrders[0]?.id ?? null}
          queueLoad={storyQueueLoad}
          readyCount={storyActiveOrders.filter((order) => order.status === "ready").length}
          selectedOrder={storySelectedOrder}
          onAction={() => {}}
          onInspect={() => {}}
          onOpenChange={() => {}}
        />
      }
      customerPanel={
        <CustomerPanel
          draft={storyDraft}
          menu={storyMenu}
          pending={false}
          priceCents={storyPriceCents}
          selectedItem={storySelectedItem}
          onSelectDrink={() => {}}
          onSubmit={() => {}}
          onUpdateDraft={() => {}}
        />
      }
    />
  ),
} satisfies Meta<typeof CoffeeShopLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ControlRoom: Story = {};

export const WarningState: Story = {
  args: {
    errorMessage:
      "Queue refresh is delayed. Showing the last successful snapshot from the backend.",
  },
};

export const ReceiptOpen: Story = {
  args: {
    receiptOrder: storyReceiptOrder,
  },
};

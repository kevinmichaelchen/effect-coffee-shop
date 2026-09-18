import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { QueueBoardCard } from "./QueueBoardCard.tsx";
import { OrderDetailsDrawer } from "./OrderDetailsDrawer.tsx";
import { RecentActivityCard } from "./RecentActivityCard.tsx";
import { storyActiveOrders } from "../coffeeShopStoryData.ts";
import { isActiveOrder, type OrderAction, type OrderStatus } from "../../lib/coffee.ts";

const nextStatus: Record<OrderAction, OrderStatus> = {
  "start-brewing": "brewing",
  "mark-ready": "ready",
  "pick-up": "picked-up",
  cancel: "cancelled",
};

function BaristaWorkflow() {
  const [orders, setOrders] = useState(storyActiveOrders);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  function handleAction(orderId: string, action: OrderAction) {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status: nextStatus[action] } : order,
      ),
    );
  }
  return (
    <div className="grid gap-5">
      <QueueBoardCard
        orders={orders.filter(isActiveOrder)}
        pendingOrderId={null}
        onAction={handleAction}
        onInspect={setSelectedId}
      />
      <RecentActivityCard
        orders={orders.filter((order) => !isActiveOrder(order))}
        onInspect={setSelectedId}
      />
      <OrderDetailsDrawer
        order={orders.find((order) => order.id === selectedId) ?? null}
        pending={false}
        onAction={handleAction}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </div>
  );
}

const meta = {
  title: "Coffee Shop/Screens/BaristaWorkflow",
  component: BaristaWorkflow,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Local, interactive workflow using production queue, drawer, and activity components. Start a ticket, mark it ready, then pick it up; completed or cancelled tickets move into recent activity. State resets when the story remounts. No network or authentication required.",
      },
    },
  },
} satisfies Meta<typeof BaristaWorkflow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const CompleteTicket: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = within(canvas.getByRole("row", { name: /ticket-1042/ }));
    await userEvent.click(row.getByRole("button", { name: "Start" }));
    await userEvent.click(row.getByRole("button", { name: "Mark Ready" }));
    await userEvent.click(row.getByRole("button", { name: "Picked Up" }));
    await expect(canvas.queryByRole("row", { name: /ticket-1042/ })).not.toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Recent activity" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /Morgan Rivera/ }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await expect(dialog.getByText("Ticket ticket-1042")).toBeInTheDocument();
    await expect(dialog.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Close" }));
  },
};
export const CancelTicket: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = within(canvas.getByRole("row", { name: /ticket-1042/ }));
    await userEvent.click(row.getByRole("button", { name: "Cancel" }));
    await expect(canvas.queryByRole("row", { name: /ticket-1042/ })).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: /Morgan Rivera.*Cancelled/ }),
    ).toBeInTheDocument();
  },
};
export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

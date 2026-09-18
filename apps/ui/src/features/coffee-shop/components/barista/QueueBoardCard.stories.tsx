import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { QueueBoardCard } from "./QueueBoardCard.tsx";
import { storyActiveOrders, storyOrder } from "../coffeeShopStoryData.ts";

const meta = {
  title: "Coffee Shop/Barista/QueueBoardCard",
  component: QueueBoardCard,
  tags: ["autodocs"],
  args: { orders: storyActiveOrders, pendingOrderId: null, onAction: fn(), onInspect: fn() },
  parameters: {
    docs: {
      description: {
        component:
          "Active tickets with status-specific actions. Updating a ticket should disable only that ticket, and inspection stays available.",
      },
    },
  },
} satisfies Meta<typeof QueueBoardCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MixedQueue: Story = {};
export const Empty: Story = {
  args: { orders: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No active tickets")).toBeInTheDocument();
    await expect(canvas.queryByRole("table")).not.toBeInTheDocument();
  },
};
export const StartTicket: Story = {
  args: { orders: [storyOrder] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Start" }));
    await expect(args.onAction).toHaveBeenCalledWith(storyOrder.id, "start-brewing");
    await userEvent.click(canvas.getByRole("button", { name: "Details" }));
    await expect(args.onInspect).toHaveBeenCalledWith(storyOrder.id);
  },
};
export const UpdatingOneTicket: Story = {
  args: { pendingOrderId: storyOrder.id },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Start" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Mark Ready" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Picked Up" })).toBeEnabled();
  },
};
export const BusyQueue: Story = {
  args: {
    orders: Array.from({ length: 12 }, (_, index) => ({
      ...storyOrder,
      id: `ticket-${1100 + index}`,
      customerName: `Customer ${index + 1}`,
    })),
  },
};
export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { CustomerOrdersPanel } from "./CustomerOrdersPanel.tsx";
import { storyActiveOrders, storyHistoryOrders } from "../coffeeShopStoryData.ts";

const meta = {
  title: "Coffee Shop/Customer/CustomerOrdersPanel",
  component: CustomerOrdersPanel,
  tags: ["autodocs"],
  args: { activeOrders: storyActiveOrders, historyOrders: storyHistoryOrders, isRefreshing: false },
  parameters: {
    docs: {
      description: {
        component:
          "Account-scoped active tickets and history, including grouped drinks and background refreshes.",
      },
    },
  },
} satisfies Meta<typeof CustomerOrdersPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveAndHistory: Story = {};
export const FirstVisit: Story = {
  args: { activeOrders: [], historyOrders: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No active tickets yet.")).toBeInTheDocument();
    await expect(canvas.getByText("Closed tickets land here.")).toBeInTheDocument();
  },
};
export const ActiveOnly: Story = { args: { historyOrders: [] } };
export const HistoryOnly: Story = { args: { activeOrders: [] } };
export const Refreshing: Story = {
  args: { isRefreshing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Refreshing tickets...")).toBeInTheDocument();
    await expect(canvas.getByText(/ticket-1042/)).toBeInTheDocument();
  },
};
export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

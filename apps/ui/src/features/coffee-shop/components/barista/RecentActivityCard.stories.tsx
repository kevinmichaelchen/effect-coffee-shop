import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { RecentActivityCard } from "./RecentActivityCard.tsx";
import { storyHistoryOrders, storyOrder } from "../coffeeShopStoryData.ts";

const meta = {
  title: "Coffee Shop/Barista/RecentActivityCard",
  component: RecentActivityCard,
  tags: ["autodocs"],
  args: { orders: storyHistoryOrders, onInspect: fn() },
} satisfies Meta<typeof RecentActivityCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CompletedAndCancelled: Story = {};
export const Empty: Story = {
  args: { orders: [] },
  parameters: {
    docs: {
      description: { story: "Intentionally renders nothing until there is recent activity." },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("heading")).not.toBeInTheDocument();
  },
};
export const InspectTicket: Story = {
  args: { orders: [{ ...storyOrder, status: "picked-up" }] },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await expect(args.onInspect).toHaveBeenCalledWith(storyOrder.id);
  },
};
export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

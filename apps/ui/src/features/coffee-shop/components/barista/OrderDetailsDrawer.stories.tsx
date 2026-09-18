import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "@effect-coffee-shop/ui-kit/components/retroui/Button";
import { OrderDetailsDrawer, type OrderDetailsDrawerProps } from "./OrderDetailsDrawer.tsx";
import { storyGroupOrder, storyOrder } from "../coffeeShopStoryData.ts";

function DrawerStory(args: OrderDetailsDrawerProps) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Inspect ticket</Button>
      <OrderDetailsDrawer
        {...args}
        order={open ? args.order : null}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          args.onOpenChange(nextOpen);
        }}
      />
    </>
  );
}

const meta = {
  title: "Coffee Shop/Barista/OrderDetailsDrawer",
  component: OrderDetailsDrawer,
  render: (args) => <DrawerStory {...args} />,
  tags: ["autodocs"],
  args: { order: storyOrder, pending: false, onAction: fn(), onOpenChange: fn() },
  parameters: {
    docs: {
      story: { inline: false, height: 640 },
      description: {
        component:
          "Ticket inspection across the order lifecycle. Available actions depend on status; a pending mutation disables actions while leaving Close available.",
      },
    },
  },
} satisfies Meta<typeof OrderDetailsDrawer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PendingTicket: Story = {
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = within(await page.findByRole("dialog"));
    dialog.getByRole("button", { name: "Start" }).focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onAction).toHaveBeenCalledWith(storyOrder.id, "start-brewing");
  },
};
export const Brewing: Story = { args: { order: { ...storyOrder, status: "brewing" } } };
export const Ready: Story = {
  args: { order: { ...storyOrder, status: "ready" } },
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = within(await page.findByRole("dialog"));
    await expect(dialog.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    dialog.getByRole("button", { name: "Picked Up" }).focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onAction).toHaveBeenCalledWith(storyOrder.id, "pick-up");
  },
};
export const PickedUp: Story = { args: { order: { ...storyOrder, status: "picked-up" } } };
export const Cancelled: Story = { args: { order: { ...storyOrder, status: "cancelled" } } };
export const Updating: Story = {
  args: { pending: true },
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = within(await page.findByRole("dialog"));
    await expect(dialog.getByRole("button", { name: "Start" })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await userEvent.click(dialog.getByRole("button", { name: "Close" }));
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(args.onAction).not.toHaveBeenCalled();
  },
};
export const GroupOrder: Story = { args: { order: storyGroupOrder } };
export const Mobile: Story = {
  args: { order: storyGroupOrder },
  globals: { viewport: { value: "mobile", isRotated: false } },
};

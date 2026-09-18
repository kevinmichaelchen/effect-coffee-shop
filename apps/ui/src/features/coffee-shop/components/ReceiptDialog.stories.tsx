import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@effect-coffee-shop/ui-kit/components/retroui/Button";
import { ReceiptDialog, type ReceiptDialogProps } from "./ReceiptDialog.tsx";
import { storyGroupOrder, storyOrder } from "./coffeeShopStoryData.ts";

function ReceiptStory(args: ReceiptDialogProps) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Show receipt</Button>
      <ReceiptDialog
        {...args}
        order={open ? args.order : null}
        onClose={() => {
          setOpen(false);
          args.onClose();
        }}
      />
    </>
  );
}

const meta = {
  title: "Coffee Shop/Customer/ReceiptDialog",
  component: ReceiptDialog,
  render: (args) => <ReceiptStory {...args} />,
  tags: ["autodocs"],
  args: {
    order: storyOrder,
    actionLabel: "Open my orders",
    onClose: fn(),
    onOpenOrders: fn(),
  },
  parameters: {
    docs: {
      story: { inline: false, height: 640 },
      description: {
        component:
          "Receipt after a successful order. Close it with either action or Escape, and reopen it with Show receipt.",
      },
    },
  },
} satisfies Meta<typeof ReceiptDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const GroupOrder: Story = { args: { order: storyGroupOrder } };
export const Mobile: Story = {
  args: { order: storyGroupOrder },
  globals: { viewport: { value: "mobile", isRotated: false } },
};
export const OpenMyOrders: Story = {
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = within(await page.findByRole("dialog"));
    await expect(dialog.getByText("$6.79")).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Open my orders" }));
    await expect(args.onOpenOrders).toHaveBeenCalledTimes(1);
    await expect(args.onClose).toHaveBeenCalledTimes(1);
    await waitFor(async () => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
  },
};
export const KeepOrdering: Story = {
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await page.findByRole("button", { name: "Keep ordering" }));
    await expect(args.onClose).toHaveBeenCalledTimes(1);
    await expect(args.onOpenOrders).not.toHaveBeenCalled();
    await userEvent.click(page.getByRole("button", { name: "Show receipt" }));
    await waitFor(async () => expect(page.getByRole("dialog")).toBeVisible());
  },
};
export const EscapeToDismiss: Story = {
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(async () => expect(page.getByRole("dialog")).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await expect(args.onClose).toHaveBeenCalledTimes(1);
    await waitFor(async () => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
  },
};

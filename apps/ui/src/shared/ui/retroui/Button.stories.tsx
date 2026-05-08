import { MoonStar } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "#shared/ui/retroui/Button.tsx";

const meta = {
  title: "Shared/RetroUI/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Brew order",
    onClick: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /brew order/i }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Outline: Story = {
  args: {
    children: "Secondary action",
    variant: "outline",
  },
};

export const VariantStrip: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const IconOnly: Story = {
  args: {
    "aria-label": "Toggle theme",
    children: <MoonStar className="size-4" />,
    size: "icon",
    variant: "outline",
  },
};

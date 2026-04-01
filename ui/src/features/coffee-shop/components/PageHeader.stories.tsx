import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, within } from "storybook/test";
import { PageHeader } from "#features/coffee-shop/components/PageHeader.tsx";

const meta = {
  title: "Coffee Shop/Navigation/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  args: {
    activeOrders: 3,
    theme: "light",
    totalOrders: 9,
    onToggleTheme: () => {},
  },
} satisfies Meta<typeof PageHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};

export const Mobile: Story = {
  globals: {
    viewport: { value: "mobile", isRotated: false },
  },
  render: (args) => (
    <div className="mx-auto max-w-sm">
      <PageHeader {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /open navigation menu/i }));
    await expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await expect(screen.getByText(/control room menu/i)).toBeInTheDocument();
  },
};

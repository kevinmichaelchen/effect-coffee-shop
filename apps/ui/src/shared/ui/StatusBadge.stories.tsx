import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusBadge } from "#shared/ui/StatusBadge.tsx";
import type { OrderStatus } from "#features/coffee-shop/lib/coffee.ts";

function StatusBadgeMatrix() {
  const statuses: readonly OrderStatus[] = [
    "pending",
    "brewing",
    "ready",
    "picked-up",
    "cancelled",
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {statuses.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  );
}

const meta = {
  title: "Shared/Feedback/StatusBadge",
  component: StatusBadgeMatrix,
  parameters: {
    a11y: {
      test: "error",
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof StatusBadgeMatrix>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllStates: Story = {};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { SessionCard } from "#features/auth/components/SessionCard.tsx";

const meta = {
  title: "Auth/Session/SessionCard",
  component: SessionCard,
  tags: ["autodocs"],
  args: {
    isPending: false,
    onSignOut: fn().mockResolvedValue(undefined),
    viewer: {
      displayName: "Kevin Chen",
      kind: "staff",
      userId: "user_01hs2f5q4rt8n5v3w2x6y7z8aa",
    },
  },
} satisfies Meta<typeof SessionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SignedIn: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(/kevin chen/i)).toBeInTheDocument();
    await expect(canvas.getByText(/user id/i)).toBeInTheDocument();
    await expect(canvas.getByText(args.viewer.userId)).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: /sign out/i }));
    await expect(args.onSignOut).toHaveBeenCalledTimes(1);
  },
};

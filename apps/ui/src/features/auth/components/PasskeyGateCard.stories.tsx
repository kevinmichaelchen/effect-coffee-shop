import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { PasskeyGateCard, type PasskeyGateCardProps } from "./PasskeyGateCard.tsx";

function PasskeyStory(args: PasskeyGateCardProps) {
  const [displayName, setDisplayName] = useState(args.displayName);
  return (
    <PasskeyGateCard
      {...args}
      displayName={displayName}
      onDisplayNameChange={(value) => {
        setDisplayName(value);
        args.onDisplayNameChange(value);
      }}
    />
  );
}

const meta = {
  title: "Auth/Passkey/PasskeyGateCard",
  component: PasskeyGateCard,
  render: (args) => <PasskeyStory {...args} />,
  tags: ["autodocs"],
  args: {
    displayName: "",
    errorMessage: null,
    isPending: false,
    pendingAction: null,
    title: "Sign in before placing an order",
    description: "Create a customer account with one passkey, then come back with a single tap.",
    onCreateAccount: fn().mockResolvedValue(undefined),
    onDisplayNameChange: fn(),
    onSignIn: fn().mockResolvedValue(undefined),
  },
  parameters: {
    docs: {
      description: {
        component:
          "Passkey UI states with local callback spies. These stories never open a real device credential prompt.",
      },
    },
  },
} satisfies Meta<typeof PasskeyGateCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NewCustomer: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "Name on your order" }), "Morgan");
    await expect(args.onDisplayNameChange).toHaveBeenLastCalledWith("Morgan");
    await userEvent.click(canvas.getByRole("button", { name: "Create account with passkey" }));
    await expect(args.onCreateAccount).toHaveBeenCalledTimes(1);
    await expect(args.onSignIn).not.toHaveBeenCalled();
  },
};
export const ReturningCustomer: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Sign in with passkey" }));
    await expect(args.onSignIn).toHaveBeenCalledTimes(1);
    await expect(args.onCreateAccount).not.toHaveBeenCalled();
  },
};
export const CreatingAccount: Story = {
  args: { displayName: "Morgan", isPending: true, pendingAction: "create-account" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("textbox")).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: "Create account with passkey" }),
    ).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Sign in with passkey" })).toBeDisabled();
    await expect(canvas.getByText("Creating account…")).toBeInTheDocument();
  },
};
export const SigningIn: Story = { args: { isPending: true, pendingAction: "sign-in" } };
export const CancelledPrompt: Story = {
  args: {
    displayName: "Morgan",
    errorMessage: "The passkey prompt was cancelled. Try again when you are ready.",
  },
};
export const ServiceUnavailable: Story = {
  args: {
    errorMessage: "We could not reach the sign-in service. Check your connection and try again.",
  },
};
export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

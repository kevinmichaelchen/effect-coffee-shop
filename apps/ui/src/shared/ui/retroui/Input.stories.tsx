import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Input } from "#shared/ui/retroui/Input.tsx";

const meta = {
  title: "Shared/RetroUI/Input",
  component: Input,
  tags: ["autodocs"],
  args: {
    onChange: fn(),
    placeholder: "Taylor",
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    value: "Too many shots",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: "Read only field",
  },
};

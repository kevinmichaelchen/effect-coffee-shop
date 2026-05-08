import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { TextField } from "#shared/ui/TextField.tsx";

interface TextFieldStoryProps {
  disabled?: boolean;
}

function TextFieldStory({ disabled = false }: TextFieldStoryProps) {
  const [value, setValue] = useState("");

  return (
    <div className="max-w-sm">
      <TextField
        disabled={disabled}
        helperText="Customer-facing label and helper copy."
        label="Customer name"
        placeholder="Taylor"
        value={value}
        onChange={setValue}
      />
    </div>
  );
}

const meta = {
  title: "Shared/Forms/TextField",
  component: TextFieldStory,
  tags: ["autodocs"],
} satisfies Meta<typeof TextFieldStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("Taylor");
    await userEvent.type(input, "Morgan");
    await expect(input).toHaveValue("Morgan");
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { TextAreaField } from "#shared/ui/TextAreaField.tsx";

function TextAreaFieldStory() {
  const [value, setValue] = useState("");

  return (
    <div className="max-w-xl">
      <TextAreaField
        helperText="Optional barista note."
        label="Notes"
        placeholder="Extra dry, quick pickup..."
        value={value}
        onChange={setValue}
      />
    </div>
  );
}

const meta = {
  title: "Shared/Forms/TextAreaField",
  component: TextAreaFieldStory,
  tags: ["autodocs"],
} satisfies Meta<typeof TextAreaFieldStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("Extra dry, quick pickup...");
    await userEvent.type(input, "No lid");
    await expect(input).toHaveValue("No lid");
  },
};

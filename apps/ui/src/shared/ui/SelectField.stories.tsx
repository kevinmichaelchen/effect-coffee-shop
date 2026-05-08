import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, within } from "storybook/test";
import { SelectField } from "#shared/ui/SelectField.tsx";

interface SelectFieldStoryProps {
  disabled?: boolean;
}

function SelectFieldStory({ disabled = false }: SelectFieldStoryProps) {
  const [value, setValue] = useState("medium");

  return (
    <div className="max-w-sm">
      <SelectField
        disabled={disabled}
        helperText="Sizes stay within backend-supported values."
        label="Size"
        options={[
          { label: "Small", value: "small" },
          { label: "Medium", value: "medium" },
          { label: "Large", value: "large" },
        ]}
        value={value}
        onChange={setValue}
      />
    </div>
  );
}

const meta = {
  title: "Shared/Forms/SelectField",
  component: SelectFieldStory,
  tags: ["autodocs"],
} satisfies Meta<typeof SelectFieldStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox");
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByText("Large"));
    await expect(trigger).toHaveTextContent("Large");
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

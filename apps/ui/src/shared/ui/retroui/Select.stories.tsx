import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, within } from "storybook/test";
import { Label } from "#shared/ui/retroui/Label.tsx";
import { Select } from "#shared/ui/retroui/Select.tsx";

interface SelectStoryProps {
  disabled?: boolean;
}

function MilkSelectStory({ disabled = false }: SelectStoryProps) {
  const [value, setValue] = useState("whole");

  return (
    <div className="grid max-w-sm gap-2">
      <Label className="font-head text-sm uppercase tracking-[0.08em]">Milk</Label>
      <Select disabled={disabled} value={value} onValueChange={setValue}>
        <Select.Trigger aria-label="Milk" className="w-full">
          <Select.Value placeholder="Choose milk" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="whole">Whole</Select.Item>
          <Select.Item value="oat">Oat</Select.Item>
          <Select.Item value="almond">Almond</Select.Item>
        </Select.Content>
      </Select>
    </div>
  );
}

const meta = {
  title: "Shared/RetroUI/Select",
  component: MilkSelectStory,
  tags: ["autodocs"],
} satisfies Meta<typeof MilkSelectStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox", { name: /milk/i }));
    await userEvent.click(await screen.findByText("Oat"));
    await expect(canvas.getByRole("combobox", { name: /milk/i })).toHaveTextContent("Oat");
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

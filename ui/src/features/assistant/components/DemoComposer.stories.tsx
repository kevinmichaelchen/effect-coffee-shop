import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DemoComposer } from "#features/assistant/components/DemoComposer.tsx";

function DemoComposerStory(inputProps: { onSubmit: () => void }) {
  const { onSubmit } = inputProps;
  const [input, setInput] = useState("");

  return (
    <div className="max-w-3xl">
      <DemoComposer
        helpText="Cmd/Ctrl + Enter sends the prompt."
        input={input}
        isBusy={false}
        submitLabel="Send to local model"
        onInputChange={setInput}
        onSubmit={onSubmit}
      />
    </div>
  );
}

const meta = {
  title: "Assistant/Blocks/DemoComposer",
  component: DemoComposerStory,
  tags: ["autodocs"],
  args: {
    onSubmit: fn(),
  },
} satisfies Meta<typeof DemoComposerStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText(/ask about the menu/i);
    await userEvent.type(input, "List open orders");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};

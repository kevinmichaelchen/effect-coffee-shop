import type { Meta, StoryObj } from "@storybook/react-vite";
import { AssistantComposer } from "#features/assistant/components/AssistantComposer.tsx";

const meta = {
  title: "Assistant/Blocks/AssistantComposer",
  component: AssistantComposer,
  tags: ["autodocs"],
  args: {
    input: "Place a medium oat latte for Maya with one extra shot.",
    isBusy: false,
    onInputChange: () => {},
    onSubmit: () => {},
  },
} satisfies Meta<typeof AssistantComposer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Busy: Story = {
  args: {
    busyDetail: "list_menu finished. Waiting on the final answer.",
    isBusy: true,
    submitLabel: "Calling live tools…",
  },
};

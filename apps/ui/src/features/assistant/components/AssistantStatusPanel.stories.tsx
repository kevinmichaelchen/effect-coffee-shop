import type { Meta, StoryObj } from "@storybook/react-vite";
import { AssistantStatusPanel } from "#features/assistant/components/AssistantStatusPanel.tsx";
import {
  errorStoryStatus,
  readyStoryStatus,
  runningStoryStatus,
} from "#features/assistant/components/assistantStoryData.ts";

const meta = {
  title: "Assistant/Blocks/AssistantStatusPanel",
  component: AssistantStatusPanel,
  tags: ["autodocs"],
  args: {
    connectionStatus: "connected",
    isBusy: false,
    status: readyStoryStatus,
  },
} satisfies Meta<typeof AssistantStatusPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Running: Story = {
  args: {
    connectionStatus: "connecting",
    isBusy: true,
    status: runningStoryStatus,
  },
};

export const Error: Story = {
  args: {
    connectionStatus: "error",
    status: errorStoryStatus,
  },
};

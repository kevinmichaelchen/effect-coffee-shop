import type { Meta, StoryObj } from "@storybook/react-vite";
import { DemoStatusPanel } from "#features/assistant/components/DemoStatusPanel.tsx";
import { coldStoryCacheStatus, storyReadyStatus, warmStoryCacheStatus } from "#features/assistant/components/assistantStoryData.ts";

const meta = {
  title: "Assistant/Blocks/DemoStatusPanel",
  component: DemoStatusPanel,
  tags: ["autodocs"],
  args: {
    cacheStatus: warmStoryCacheStatus,
    hasLoadedModel: true,
    isBusy: false,
    status: storyReadyStatus,
  },
} satisfies Meta<typeof DemoStatusPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Downloading: Story = {
  args: {
    cacheStatus: coldStoryCacheStatus,
    hasLoadedModel: false,
    isBusy: true,
    status: {
      label: "Downloading tokenizer and browser model",
      phase: "loading",
      progress: 58,
    },
  },
};

export const Error: Story = {
  args: {
    cacheStatus: coldStoryCacheStatus,
    hasLoadedModel: false,
    isBusy: false,
    status: {
      label: "Local demo unavailable",
      phase: "error",
      progress: 0,
    },
  },
};

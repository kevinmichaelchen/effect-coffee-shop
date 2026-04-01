import type { Meta, StoryObj } from "@storybook/react-vite";
import { BrowserMcpLandingView } from "#features/assistant/components/BrowserMcpLandingView.tsx";
import {
  coldStoryCacheStatus,
  storyAssistantEvents,
  storyAssistantMessages,
  storyAssistantPrompts,
  storyReadyStatus,
  warmStoryCacheStatus,
} from "#features/assistant/components/assistantStoryData.ts";

const meta = {
  title: "Assistant/Screens/BrowserMcpLanding",
  component: BrowserMcpLandingView,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    assistantDraft: "",
    cacheStatus: warmStoryCacheStatus,
    errorMessage: null,
    events: storyAssistantEvents,
    hasLoadedModel: true,
    input: "",
    isBusy: false,
    messages: storyAssistantMessages,
    prompts: storyAssistantPrompts,
    status: storyReadyStatus,
    theme: "light",
    onInputChange: () => {},
    onPromptClick: () => {},
    onReset: () => {},
    onSubmit: () => {},
    onToggleTheme: () => {},
    onWarmUp: () => {},
  },
} satisfies Meta<typeof BrowserMcpLandingView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Downloading: Story = {
  args: {
    cacheStatus: coldStoryCacheStatus,
    hasLoadedModel: false,
    isBusy: true,
    messages: [],
    status: {
      label: "Downloading tokenizer and browser model",
      phase: "loading",
      progress: 42,
    },
  },
};

export const Failure: Story = {
  args: {
    cacheStatus: coldStoryCacheStatus,
    errorMessage: "WebGPU is unavailable in this browser tab.",
    events: [],
    hasLoadedModel: false,
    messages: [],
    status: {
      label: "Local demo unavailable",
      phase: "error",
      progress: 0,
    },
  },
};

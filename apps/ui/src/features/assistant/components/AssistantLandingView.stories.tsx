import type { Meta, StoryObj } from "@storybook/react-vite";
import { AssistantLandingView } from "#features/assistant/components/AssistantLandingView.tsx";
import {
  errorStoryStatus,
  readyStoryStatus,
  runningStoryStatus,
  storyAssistantEvents,
  storyAssistantMessages,
  storyAssistantPrompts,
} from "#features/assistant/components/assistantStoryData.ts";

const meta = {
  title: "Assistant/Screens/AssistantLanding",
  component: AssistantLandingView,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    connectionStatus: "connected",
    errorMessage: null,
    events: storyAssistantEvents,
    input: "",
    isBusy: false,
    messages: storyAssistantMessages,
    prompts: storyAssistantPrompts,
    status: readyStoryStatus,
    theme: "light",
    onInputChange: () => {},
    onPromptClick: () => {},
    onReset: () => {},
    onSubmit: () => {},
    onToggleTheme: () => {},
  },
} satisfies Meta<typeof AssistantLandingView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Running: Story = {
  args: {
    connectionStatus: "connecting",
    isBusy: true,
    messages: [],
    status: runningStoryStatus,
  },
};

export const Failure: Story = {
  args: {
    connectionStatus: "error",
    errorMessage: "Set a Beanline AI provider and model before using the assistant.",
    events: [],
    messages: [],
    status: errorStoryStatus,
  },
};

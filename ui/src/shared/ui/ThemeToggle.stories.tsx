import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ThemeToggle } from "#shared/ui/ThemeToggle.tsx";
import type { ThemePreference } from "#shared/hooks/useThemePreference.ts";

function ThemeToggleStory() {
  const [theme, setTheme] = useState<ThemePreference>("light");

  return <ThemeToggle theme={theme} onToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))} />;
}

const meta = {
  title: "Shared/Feedback/ThemeToggle",
  component: ThemeToggleStory,
  tags: ["autodocs"],
} satisfies Meta<typeof ThemeToggleStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /switch to dark/i });
    await userEvent.click(button);
    await expect(canvas.getByRole("button", { name: /switch to light/i })).toBeInTheDocument();
  },
};

import type { Preview } from "@storybook/react-vite";
import { StorybookShell } from "./StorybookShell.tsx";
import "../src/index.css";

const viewportOptions = {
  mobile: {
    name: "Mobile",
    styles: { width: "390px", height: "844px" },
    type: "mobile",
  },
  tablet: {
    name: "Tablet",
    styles: { width: "768px", height: "1024px" },
    type: "tablet",
  },
  desktop: {
    name: "Desktop",
    styles: { width: "1280px", height: "960px" },
    type: "desktop",
  },
} as const;

const preview: Preview = {
  tags: ["test"],
  parameters: {
    a11y: {
      test: "todo",
    },
    layout: "padded",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      options: viewportOptions,
    },
    options: {
      storySort: {
        order: [
          "Shared",
          ["RetroUI", "Forms", "Feedback"],
          "Coffee Shop",
          ["Navigation", "Customer", "Barista", "Screens"],
          "Assistant",
          ["Blocks", "Screens"],
        ],
      },
    },
  },
  initialGlobals: {
    theme: "light",
    viewport: { value: "desktop", isRotated: false },
  },
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Global color theme",
      defaultValue: "light",
      toolbar: {
        icon: "mirror",
        items: [
          { title: "Light", value: "light" },
          { title: "Dark", value: "dark" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === "dark" ? "dark" : "light";

      return (
        <StorybookShell theme={theme}>
          <Story />
        </StorybookShell>
      );
    },
  ],
};

export default preview;

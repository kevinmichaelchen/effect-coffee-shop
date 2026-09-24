import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initializeTheme } from "@effect-coffee-shop/ui-kit/hooks/useThemePreference";
import App from "#App";
import { AppProviders } from "#app/AppProviders.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  console.error("Missing #root element.");
} else {
  initializeTheme();
  createRoot(rootElement).render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  );
}

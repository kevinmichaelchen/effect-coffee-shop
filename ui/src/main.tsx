import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "#App";
import { AppProviders } from "#app/AppProviders.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Missing #root element.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);

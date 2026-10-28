import { Effect } from "effect";
import { Runtime } from "foldkit";
import { Model } from "./model.ts";
import { Message } from "./message.ts";
import { Flags, init } from "./init.ts";
import { update } from "./update.ts";
import { subscriptions } from "./sync.ts";
import { view } from "./view.ts";
import "./index.css";
const flags = Effect.sync(() => {
  const path = location.pathname;
  const page =
    path === "/staff"
      ? "staff"
      : path === "/login/mcp"
        ? "mcp"
        : path === "/" || path === "/shop"
          ? "customer"
          : "not-found";
  const theme = localStorage.getItem("coffee-theme") === "dark" ? "dark" : "light";
  return Flags.make({ page, theme });
});
const application = Runtime.makeApplication({
  Model,
  Flags,
  init,
  update,
  view,
  subscriptions,
  container: document.getElementById("root"),
  devTools: { Message },
});
Runtime.run(application, { flags });

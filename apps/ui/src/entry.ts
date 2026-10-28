import { Runtime } from "foldkit";
import { themeStorageKey } from "@effect-coffee-shop/ui-kit/components/theme";
import { Flags, flags, init } from "#app/main.ts";
import { Message } from "#app/message.ts";
import { Model } from "#app/model.ts";
import { subscriptions } from "#app/subscription.ts";
import { update } from "#app/update.ts";
import { view } from "#app/view/root.ts";
import "./index.css";

// Apply the saved theme before the first paint so dark users never see a light flash.
document.documentElement.classList.toggle(
  "dark",
  window.localStorage.getItem(themeStorageKey) === "dark",
);

const application = Runtime.makeApplication({
  Model,
  Flags,
  init,
  update,
  view,
  subscriptions,
  container: document.getElementById("root"),
  routing: {
    onUrlRequest: (request) => Message.ClickedLink({ request }),
    onUrlChange: (url) => Message.ChangedUrl({ url }),
  },
});

Runtime.run(application, { flags });

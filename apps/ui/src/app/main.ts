import { Dialog } from "@foldkit/ui";
import { Effect, Option, Schema } from "effect";
import { type Runtime } from "foldkit";
import { Url } from "foldkit/url";
import { ThemePreference, themeStorageKey } from "@effect-coffee-shop/ui-kit/components/theme";
import { anonymousViewer } from "#features/auth/lib/viewer.ts";
import { ApplyTheme } from "#app/command.ts";
import type { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";
import { urlToAppRoute } from "#app/route.ts";
import { bootCommands } from "#app/update.ts";

export const Flags = Schema.Struct({ theme: ThemePreference });
export type Flags = typeof Flags.Type;

/** The saved theme preference, read once at startup. */
export const flags: Effect.Effect<Flags> = Effect.sync(() =>
  Flags.make({
    theme: Option.getOrElse(
      Schema.decodeUnknownOption(ThemePreference)(window.localStorage.getItem(themeStorageKey)),
      () => "light" as const,
    ),
  }),
);

export const init: Runtime.RoutingApplicationInit<Model, Message, Flags> = (
  flags: Flags,
  url: Url,
) => {
  const route = urlToAppRoute(url);
  return {
    model: {
      route,
      theme: flags.theme,
      viewer: anonymousViewer,
      viewerError: Option.none(),
      displayName: "",
      pendingAuth: Option.none(),
      authError: Option.none(),
      menu: [],
      menuError: Option.none(),
      orders: [],
      ordersError: Option.none(),
      draft: Option.none(),
      isPlacingOrder: false,
      receipt: Option.none(),
      receiptDialog: Dialog.init({ id: "receipt-dialog" }),
      selectedOrderId: Option.none(),
      pendingOrderId: Option.none(),
      detailsDialog: Dialog.init({ id: "details-dialog" }),
      detailsError: Option.none(),
      copyState: "idle",
      menuDialog: Dialog.init({ id: "menu-dialog" }),
      toasts: [],
      toastCount: 0,
    },
    commands: [ApplyTheme({ theme: flags.theme }), ...bootCommands(route)],
  };
};

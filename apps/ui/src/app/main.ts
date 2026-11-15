import { Dialog } from "@foldkit/ui";
import * as DomainFoldkit from "@alchemy.run/domain/Foldkit";
import { Effect, Option, Schema } from "effect";
import type { Runtime } from "foldkit";
import type { Url } from "foldkit/url";
import { SecureRandom } from "effect/crypto";
import { ThemePreference, themeStorageKey } from "@effect-coffee-shop/ui-kit/components/theme";
import { initialAssistant } from "#features/assistant/lib/state.ts";
import { ApplyTheme } from "#app/command.ts";
import type { Message } from "../message.ts";
import { MenuData, OrdersData, Toast, ViewerData, type Model } from "#app/model.ts";
import type { AppServices } from "#app/resources.ts";
import { urlToAppRoute } from "#app/route.ts";
import { bootCommands } from "#app/update.ts";

export const Flags = Schema.Struct({
  theme: ThemePreference,
  commandIds: DomainFoldkit.CommandIds,
});
export type Flags = typeof Flags.Type;

/**
 * The saved theme preference, read once at startup, and a fresh command-id
 * session: ids must not repeat ones an earlier page load already sent.
 */
export const flags: Effect.Effect<Flags> = Effect.sync(() =>
  Flags.make({
    theme: Option.getOrElse(
      Schema.decodeUnknownOption(ThemePreference)(window.localStorage.getItem(themeStorageKey)),
      () => "light" as const,
    ),
    commandIds: { session: SecureRandom.uuidV4Unsafe(), sent: 0 },
  }),
);

export const init: Runtime.RoutingApplicationInit<Model, Message, Flags, AppServices> = (
  flags: Flags,
  url: Url,
) => {
  const route = urlToAppRoute(url);
  return {
    model: {
      route,
      theme: flags.theme,
      viewer: ViewerData.Idle(),
      displayName: "",
      pendingAuth: Option.none(),
      authError: Option.none(),
      menu: MenuData.Idle(),
      orders: OrdersData.Idle(),
      draft: Option.none(),
      commandIds: flags.commandIds,
      isPlacingOrder: false,
      pendingOrder: Option.none(),
      receipt: Option.none(),
      receiptDialog: Dialog.init({ id: "receipt-dialog" }),
      selectedOrderId: Option.none(),
      pendingOrderId: Option.none(),
      orderActionAttempt: Option.none(),
      detailsDialog: Dialog.init({ id: "details-dialog" }),
      detailsError: Option.none(),
      copyState: "idle",
      menuDialog: Dialog.init({ id: "menu-dialog" }),
      toast: Toast.init({ id: "app-toast", defaultDuration: "4 seconds" }),
      assistant: initialAssistant,
    },
    commands: [ApplyTheme({ theme: flags.theme }), ...bootCommands(route)],
  };
};

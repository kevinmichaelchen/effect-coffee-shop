import { Option } from "effect";
import { Update } from "foldkit";
import { Message } from "../message.ts";
import { Toast, type Model } from "#app/model.ts";
import type { UpdateStep } from "#app/resources.ts";

const toastFold = {
  read: (model: Model) => Option.some(model.toast),
  write: (model: Model, toast: Model["toast"]): Model => ({ ...model, toast }),
  toParentMessage: (message: typeof Toast.Message.Type) => Message.GotToastMessage({ message }),
  foldOutMessage: Toast.OutMessage.match<UpdateStep>({
    DismissedToast: () => (model) => ({ model }),
  }),
};

/** Toast's own Messages: the dismiss timer, hover, and enter/leave animations. */
export const foldToast = Update.foldChild({ ...toastFold, update: Toast.update });

/** Shows one entry; the stack dismisses it after the configured duration. */
export const withToast = (kind: "success" | "error", message: string): UpdateStep =>
  Update.foldChildStep({
    ...toastFold,
    update: (toast) =>
      Toast.show(toast, {
        payload: { kind, message },
        variant: kind === "success" ? "Success" : "Error",
      }),
  });

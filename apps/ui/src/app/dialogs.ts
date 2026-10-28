import { Dialog } from "@foldkit/ui";
import { Option } from "effect";
import { Update } from "foldkit";
import { ExpireToast } from "#app/command.ts";
import { Message } from "#app/message.ts";
import type { Model, Toast } from "#app/model.ts";

type UpdateStep = Update.Step<Model, Message>;

// TOASTS

export const withToast =
  (kind: Toast["kind"], message: string): UpdateStep =>
  (model) => {
    const id = `toast-${model.toastCount}`;
    return {
      model: {
        ...model,
        toastCount: model.toastCount + 1,
        toasts: [...model.toasts, { id, kind, message }],
      },
      commands: [ExpireToast({ id })],
    };
  };

// DIALOGS

const toReceiptMessage = (message: Dialog.Message): Message =>
  Message.GotReceiptDialogMessage({ message });
const toDetailsMessage = (message: Dialog.Message): Message =>
  Message.GotDetailsDialogMessage({ message });
const toMenuMessage = (message: Dialog.Message): Message =>
  Message.GotMenuDialogMessage({ message });

const noOutMessage = Dialog.OutMessage.match<UpdateStep>({
  Opened: () => (model) => ({ model }),
  Closed: () => (model) => ({ model }),
});

const receiptDialog = {
  update: Dialog.update,
  read: (model: Model) => Option.some(model.receiptDialog),
  write: (model: Model, receiptDialog: Dialog.Model): Model => ({ ...model, receiptDialog }),
  toParentMessage: toReceiptMessage,
  foldOutMessage: Dialog.OutMessage.match<UpdateStep>({
    Opened: () => (model) => ({ model }),
    Closed: () => (model) => ({ model: { ...model, receipt: Option.none() } }),
  }),
};

const detailsDialog = {
  update: Dialog.update,
  read: (model: Model) => Option.some(model.detailsDialog),
  write: (model: Model, detailsDialog: Dialog.Model): Model => ({ ...model, detailsDialog }),
  toParentMessage: toDetailsMessage,
  foldOutMessage: Dialog.OutMessage.match<UpdateStep>({
    Opened: () => (model) => ({ model }),
    Closed: () => (model) => ({
      model: { ...model, selectedOrderId: Option.none(), detailsError: Option.none() },
    }),
  }),
};

const menuDialog = {
  update: Dialog.update,
  read: (model: Model) => Option.some(model.menuDialog),
  write: (model: Model, menuDialog: Dialog.Model): Model => ({ ...model, menuDialog }),
  toParentMessage: toMenuMessage,
  foldOutMessage: noOutMessage,
};

export const foldReceipt = Update.foldChild(receiptDialog);
export const openReceipt = Update.foldChildStep({ ...receiptDialog, update: Dialog.open });
export const closeReceipt = Update.foldChildStep({ ...receiptDialog, update: Dialog.close });
export const foldDetails = Update.foldChild(detailsDialog);
export const openDetails = Update.foldChildStep({ ...detailsDialog, update: Dialog.open });
export const closeDetails = Update.foldChildStep({ ...detailsDialog, update: Dialog.close });
export const foldMenu = Update.foldChild(menuDialog);
export const openMenu = Update.foldChildStep({ ...menuDialog, update: Dialog.open });
export const closeMenu = Update.foldChildStep({ ...menuDialog, update: Dialog.close });

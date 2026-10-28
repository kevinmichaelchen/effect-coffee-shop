import { AsyncData } from "foldkit";
import type { HtmlBuilder } from "foldkit/html";
import { Model } from "./model.ts";
import { Message } from "./message.ts";
import { button, field } from "./controls.ts";
import { composer } from "./composer.ts";
import { orderList } from "./orders-view.ts";
import type { Viewer } from "./data.ts";
export const workspace = (model: Model, h: HtmlBuilder<Message>) =>
  AsyncData.matchDataSplitEmpty(model.viewer, {
    onIdle: () => h.p([], ["Loading your session…"]),
    onLoading: () => h.p([], ["Loading your session…"]),
    onFailure: (error) => h.p([h.Role("alert")], [error]),
    onData: (viewer) =>
      viewer.kind === "anonymous" ? signInView(model, h) : signedInView(model, viewer, h),
  });
const signInView = (model: Model, h: HtmlBuilder<Message>) =>
  h.section(
    [h.Class("panel auth")],
    [
      h.p([h.Class("eyebrow")], ["WELCOME TO YOUR DAILY RITUAL"]),
      h.h2([], ["Good coffee. One passkey away."]),
      h.p([], ["Create an account to order, or sign in with your existing passkey."]),
      field("Your name", "display-name", model.displayName, (value) =>
        Message.ChangedName({ value }),
      )(h),
      h.div(
        [h.Class("actions")],
        [
          button("Create account", Message.ClickedAuth({ action: "register" }), h, model.pending),
          button("Sign in", Message.ClickedAuth({ action: "sign-in" }), h, model.pending),
        ],
      ),
    ],
  );
const signedInView = (
  model: Model,
  viewer: Exclude<Viewer, { kind: "anonymous" }>,
  h: HtmlBuilder<Message>,
) =>
  h.div(
    [],
    [
      h.div(
        [h.Class("session row")],
        [
          h.p([], [`Welcome, ${viewer.displayName}`]),
          button("Sign out", Message.ClickedAuth({ action: "sign-out" }), h, model.pending),
        ],
      ),
      model.page === "staff" && viewer.kind !== "staff"
        ? h.p([h.Role("alert")], ["Staff access is required for this workspace."])
        : h.div(
            [h.Class(model.page === "staff" ? "staff-workspace" : "workspace")],
            [model.page === "staff" ? h.empty : composer(model, h), orderList(model, h)],
          ),
    ],
  );

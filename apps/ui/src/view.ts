import { Option } from "effect";
import type { Document, HtmlBuilder } from "foldkit/html";
import { Model } from "./model.ts";
import { Message } from "./message.ts";
import { button } from "./controls.ts";
import { ticket } from "./orders-view.ts";
import { workspace } from "./workspace-view.ts";
export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: "Effect Coffee",
  body: h.div(
    [h.Class("app"), h.DataAttribute("theme", model.theme)],
    [
      header(model, h),
      h.main(
        [],
        [
          hero(model, h),
          Option.match(model.error, {
            onNone: () => h.empty,
            onSome: (error) =>
              h.div(
                [h.Role("alert"), h.Class("error")],
                [error, button("Retry", Message.ClickedRetry(), h)],
              ),
          }),
          model.page === "not-found" ? h.h2([], ["Page not found"]) : workspace(model, h),
          Option.match(model.receipt, {
            onNone: () => h.empty,
            onSome: (order) =>
              h.section(
                [h.Class("panel receipt"), h.Role("region"), h.AriaLabel("Order receipt")],
                [
                  h.h2([], ["Your receipt"]),
                  ticket(order, model, h),
                  button("Close receipt", Message.DismissedReceipt(), h),
                ],
              ),
          }),
        ],
      ),
      h.footer([], ["Small rituals, made with care."]),
    ],
  ),
});

const header = (model: Model, h: HtmlBuilder<Message>) =>
  h.header(
    [h.Class("header row")],
    [
      h.a(
        [h.Href("/"), h.Class("brand")],
        ["effect coffee", h.span([], ["A LITTLE RITUAL. A BETTER DAY."])],
      ),
      h.nav(
        [h.Class("actions"), h.AriaLabel("Main navigation")],
        [
          h.a([h.Href("/")], ["Order"]),
          h.a([h.Href("/staff")], ["Staff"]),
          button(model.theme === "light" ? "Dark mode" : "Light mode", Message.ClickedTheme(), h),
        ],
      ),
    ],
  );
const hero = (model: Model, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("hero")],
    [
      h.p([h.Class("eyebrow")], ["FRESHLY BREWED, THOUGHTFULLY MADE"]),
      h.h1([], [model.page === "staff" ? "Every cup has a story." : "Make time for a good cup."]),
      h.p(
        [],
        [
          model.page === "staff"
            ? "Your live barista workspace."
            : "Choose your drink. Make it yours. We’ll take care of the rest.",
        ],
      ),
    ],
  );

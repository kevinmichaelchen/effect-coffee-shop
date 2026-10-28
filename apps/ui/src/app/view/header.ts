import { Dialog } from "@foldkit/ui";
import type { HtmlBuilder } from "foldkit/html";
import {
  button,
  linkButton,
  type ButtonVariant,
} from "@effect-coffee-shop/ui-kit/components/button";
import { overlay } from "@effect-coffee-shop/ui-kit/components/overlay";
import { text } from "@effect-coffee-shop/ui-kit/components/text";
import { themeToggle } from "@effect-coffee-shop/ui-kit/components/theme";
import { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";
import { staffRouter, shopRouter } from "#app/route.ts";

type Builder = HtmlBuilder<Message>;

interface NavLink {
  readonly href: string;
  readonly label: string;
  readonly variant: ButtonVariant;
}

const navLinksFor = (target: "shop" | "staff"): readonly NavLink[] => [
  target === "staff"
    ? { href: staffRouter(), label: "Staff queue", variant: "outline" }
    : { href: shopRouter(), label: "Customer workspace", variant: "outline" },
];

function sessionSummary(active: number, total: number, h: Builder) {
  return h.div(
    [h.Class("flex flex-wrap items-center gap-3 text-sm text-muted-foreground")],
    [
      text(
        {},
        [h.span([h.Class("font-semibold text-foreground")], [String(active)]), " active"],
        h,
      ),
      text({}, [h.span([h.Class("font-semibold text-foreground")], [String(total)]), " total"], h),
    ],
  );
}

function menuDrawer(model: Model, links: readonly NavLink[], active: number, h: Builder) {
  return h.submodel({
    slotId: model.menuDialog.id,
    model: model.menuDialog,
    view: Dialog.view,
    viewInputs: {
      hasDescription: true,
      toView: (info: Dialog.RenderInfo) =>
        overlay(
          "right",
          info,
          {
            title: "Workspace menu",
            description: "Navigation and theme controls.",
            body: [
              sessionSummary(active, model.orders.length, h),
              h.div(
                [h.Class("grid gap-2")],
                links.map((link) =>
                  linkButton(
                    { className: "justify-center", href: link.href, variant: link.variant },
                    [link.label],
                    h,
                  ),
                ),
              ),
              themeToggle({ theme: model.theme, onToggle: Message.ClickedToggleTheme() }, h),
            ],
            footer: [button({ attributes: [...info.closeButton], variant: "ghost" }, ["Close"], h)],
          },
          h,
        ),
    },
    toParentMessage: (message) => Message.GotMenuDialogMessage({ message }),
  });
}

interface HeaderProps {
  readonly title: string;
  readonly footerLabel: string;
  readonly target: "shop" | "staff";
  readonly active: number;
}

function headerRow(model: Model, props: HeaderProps, links: readonly NavLink[], h: Builder) {
  return h.div(
    [h.Class("flex min-h-14 items-start justify-between gap-3")],
    [
      h.div(
        [h.Class("grid min-w-0 flex-1 gap-1")],
        [
          text({ className: "text-xs font-medium text-muted-foreground" }, ["Coffee shop"], h),
          text(
            { as: "h1", className: "max-w-3xl text-2xl font-semibold leading-tight md:text-3xl" },
            [props.title],
            h,
          ),
        ],
      ),
      h.div(
        [h.Class("hidden shrink-0 items-center gap-2 md:flex")],
        [
          ...links.map((link) =>
            linkButton({ href: link.href, size: "sm", variant: link.variant }, [link.label], h),
          ),
          themeToggle(
            { compact: true, theme: model.theme, onToggle: Message.ClickedToggleTheme() },
            h,
          ),
        ],
      ),
      button(
        {
          attributes: [h.OnClick(Message.ClickedOpenMenu()), h.AriaLabel("Open navigation menu")],
          className: "md:hidden",
          size: "icon",
          variant: "outline",
        },
        ["☰"],
        h,
      ),
    ],
  );
}

export function pageHeader(model: Model, props: HeaderProps, h: Builder) {
  const links = navLinksFor(props.target);
  return h.header(
    [h.Class("grid gap-4 border-b border-border pb-4")],
    [
      headerRow(model, props, links, h),
      h.div(
        [h.Class("flex flex-wrap items-center justify-between gap-3")],
        [
          text({ className: "text-sm text-muted-foreground" }, [props.footerLabel], h),
          sessionSummary(props.active, model.orders.length, h),
        ],
      ),
      menuDrawer(model, links, props.active, h),
    ],
  );
}

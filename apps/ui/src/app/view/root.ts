import { Match, Option } from "effect";
import type { Document, HtmlBuilder } from "foldkit/html";
import { card, cardContent } from "@effect-coffee-shop/ui-kit/components/card";
import { linkButton } from "@effect-coffee-shop/ui-kit/components/button";
import { text } from "@effect-coffee-shop/ui-kit/components/text";
import { toastRegion } from "@effect-coffee-shop/ui-kit/components/toast";
import { getQueueLoad } from "#features/coffee-shop/lib/coffee.ts";
import { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";
import { shopRouter, staffRouter } from "#app/route.ts";
import { authGate } from "#app/view/auth.ts";
import { customerWorkspace, receiptDialog } from "#app/view/customer.ts";
import { pageHeader } from "#app/view/header.ts";
import { metricStrip, workspaceWarning } from "#app/view/shared.ts";
import { staffAccessWarning, staffQueue, staffSnapshot } from "#app/view/staff.ts";
import { isActiveOrder } from "#features/coffee-shop/lib/coffee.ts";

type Builder = HtmlBuilder<Message>;

const pageShell = "mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 py-5 lg:px-6";

const firstMessage = (...candidates: readonly Option.Option<string>[]) =>
  candidates.reduce<Option.Option<string>>(
    (found, candidate) => Option.orElse(found, () => candidate),
    Option.none(),
  );

const warningFor = (model: Model, h: Builder) =>
  Option.match(firstMessage(model.viewerError, model.menuError, model.ordersError), {
    onNone: () => [],
    onSome: (message) => [workspaceWarning(message, h)],
  });

function shopPage(model: Model, h: Builder) {
  const active = model.orders.filter(isActiveOrder).length;
  const signedIn = model.viewer.kind !== "anonymous";
  return h.main(
    [h.Class(pageShell)],
    [
      pageHeader(
        model,
        {
          active,
          footerLabel: "Order for yourself with passkey-scoped tickets",
          target: "staff",
          title: "Customer workspace",
        },
        h,
      ),
      metricStrip(
        [
          { label: "Menu", value: String(model.menu.length) },
          { label: "Active", value: String(active) },
          { label: "History", value: String(model.orders.length - active) },
        ],
        h,
      ),
      ...warningFor(model, h),
      authGate(
        model,
        {
          description:
            "Create a customer account with one passkey, then come back with a single tap.",
          title: "Sign in before placing an order",
        },
        h,
      ),
      ...(signedIn ? [customerWorkspace(model, h)] : []),
      receiptDialog(model, h),
    ],
  );
}

function staffPage(model: Model, h: Builder) {
  const { active, history, ready } = staffSnapshot(model);
  const load = getQueueLoad(active.length);
  const staffSession = model.viewer.kind === "staff";
  return h.main(
    [h.Class(pageShell)],
    [
      pageHeader(
        model,
        {
          active: active.length,
          footerLabel: "Staff-only queue management",
          target: "shop",
          title: "Staff workspace",
        },
        h,
      ),
      metricStrip(
        [
          { label: "Active", value: String(active.length) },
          { label: "Ready", value: String(ready) },
          { label: "History", value: String(history.length) },
          { label: "Load", progress: load, value: `${load}%` },
        ],
        h,
      ),
      ...warningFor(model, h),
      authGate(
        model,
        {
          description: "Only staff-listed accounts can manage the live queue.",
          title: "Sign in with your staff passkey",
        },
        h,
      ),
      ...(model.viewer.kind === "customer" ? [staffAccessWarning(h)] : []),
      ...(staffSession ? [staffQueue(model, h)] : []),
    ],
  );
}

function notFoundPage(h: Builder) {
  return h.main(
    [h.Class("mx-auto grid min-h-screen w-full max-w-3xl place-items-center px-4 py-6")],
    [
      card(
        { className: "w-full" },
        [
          cardContent(
            { className: "grid gap-4 p-6 text-center" },
            [
              text(
                { as: "h1", className: "text-3xl font-semibold leading-tight" },
                ["Page not found"],
                h,
              ),
              text(
                { className: "text-muted-foreground" },
                ["Head back to the customer or staff workspace."],
                h,
              ),
              h.div(
                [h.Class("flex flex-wrap justify-center gap-3")],
                [
                  linkButton({ href: shopRouter() }, ["Open customer workspace"], h),
                  linkButton(
                    { href: staffRouter(), variant: "outline" },
                    ["Open staff workspace"],
                    h,
                  ),
                ],
              ),
            ],
            h,
          ),
        ],
        h,
      ),
    ],
  );
}

const pageTitle = (model: Model): string =>
  Match.value(model.route).pipe(
    Match.tag("Staff", () => "Staff workspace | Coffee shop"),
    Match.tag("NotFound", () => "Page not found | Coffee shop"),
    Match.orElse(() => "Customer workspace | Coffee shop"),
  );

export const view = (model: Model, h: Builder): Document => ({
  title: pageTitle(model),
  body: h.div(
    [],
    [
      Match.value(model.route).pipe(
        Match.tag("Staff", () => staffPage(model, h)),
        Match.tag("NotFound", () => notFoundPage(h)),
        Match.orElse(() => shopPage(model, h)),
      ),
      toastRegion(
        model.toasts.map((toast) => ({
          ...toast,
          onDismiss: Message.DismissedToast({ id: toast.id }),
        })),
        h,
      ),
    ],
  ),
});

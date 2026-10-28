import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";
import { alert } from "@effect-coffee-shop/ui-kit/components/alert";
import { button } from "@effect-coffee-shop/ui-kit/components/button";
import { card, cardContent, cardTitleHeader } from "@effect-coffee-shop/ui-kit/components/card";
import { textField } from "@effect-coffee-shop/ui-kit/components/field";
import { text } from "@effect-coffee-shop/ui-kit/components/text";
import type { AuthenticatedViewer } from "#features/auth/lib/viewer.ts";
import { Message } from "#app/message.ts";
import type { AuthAction, Model } from "#app/model.ts";

type Builder = HtmlBuilder<Message>;

const pendingLabels = {
  "create-account": "Waiting for your passkey…",
  "sign-in": "Checking your passkey…",
  "sign-out": "Signing you out…",
} satisfies Record<AuthAction, string>;

function passkeyActions(isPending: boolean, h: Builder) {
  return h.div(
    [h.Class("flex flex-wrap gap-3")],
    [
      button(
        { attributes: [h.OnClick(Message.ClickedCreateAccount())], disabled: isPending },
        ["Create account with passkey"],
        h,
      ),
      button(
        {
          attributes: [h.OnClick(Message.ClickedSignIn())],
          disabled: isPending,
          variant: "outline",
        },
        ["Sign in with passkey"],
        h,
      ),
    ],
  );
}

function passkeyNotices(model: Model, h: Builder) {
  return [
    ...Option.match(model.pendingAuth, {
      onNone: () => [],
      onSome: (action) => [
        alert(
          { status: "info", surface: "background", title: pendingLabels[action] },
          ["Use your device’s passkey prompt to continue."],
          h,
        ),
      ],
    }),
    ...Option.match(model.authError, {
      onNone: () => [],
      onSome: (message) => [
        alert({ status: "warning", title: "Could not complete passkey flow" }, [message], h),
      ],
    }),
  ];
}

export function passkeyGate(
  model: Model,
  props: { readonly title: string; readonly description: string },
  h: Builder,
) {
  const isPending = Option.isSome(model.pendingAuth);
  const nameField = textField(
    {
      id: "passkey-display-name",
      label: "Name on your order",
      value: model.displayName,
      placeholder: "Taylor",
      autocomplete: "name",
      disabled: isPending,
      onInput: (value) => Message.ChangedDisplayName({ value }),
      helperText: "New customers register once, then come back with a single passkey tap.",
    },
    h,
  );
  return card(
    { className: "w-full" },
    [
      cardTitleHeader(props.title, props.description, h),
      cardContent(
        { className: "grid gap-5" },
        [nameField, passkeyActions(isPending, h), ...passkeyNotices(model, h)],
        h,
      ),
    ],
    h,
  );
}

const copyLabels = { idle: "Copy ID", copied: "Copied", failed: "Copy failed" } satisfies Record<
  Model["copyState"],
  string
>;

function sessionIdentity(viewer: AuthenticatedViewer, copyState: Model["copyState"], h: Builder) {
  return h.div(
    [h.Class("grid gap-1.5")],
    [
      h.div(
        [h.Class("flex flex-wrap items-center gap-2")],
        [
          h.span([h.Class("size-2 rounded-full bg-status-online")]),
          text({ className: "text-sm text-muted-foreground" }, [`Signed in · ${viewer.kind}`], h),
        ],
      ),
      text({ as: "h3" }, [viewer.displayName], h),
      text(
        { className: "text-sm text-muted-foreground" },
        ["Orders placed here are scoped to your account."],
        h,
      ),
      h.div(
        [h.Class("flex flex-wrap items-center gap-2 pt-1")],
        [
          text(
            { className: "text-xs uppercase tracking-label text-muted-foreground" },
            ["User ID"],
            h,
          ),
          h.code(
            [h.Class("rounded border border-border bg-muted px-2 py-1 font-mono text-xs")],
            [viewer.userId],
          ),
          button(
            {
              attributes: [h.OnClick(Message.ClickedCopyUserId())],
              className: "min-w-24 justify-center",
              size: "sm",
              variant: "outline",
            },
            [copyLabels[copyState]],
            h,
          ),
        ],
      ),
    ],
  );
}

export function sessionCard(model: Model, viewer: AuthenticatedViewer, h: Builder) {
  return card(
    { className: "w-full" },
    [
      cardContent(
        { className: "flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between" },
        [
          sessionIdentity(viewer, model.copyState, h),
          button(
            {
              attributes: [h.OnClick(Message.ClickedSignOut())],
              disabled: Option.isSome(model.pendingAuth),
              variant: "outline",
            },
            ["Sign out"],
            h,
          ),
        ],
        h,
      ),
    ],
    h,
  );
}

/** The session card when signed in, otherwise the passkey gate. */
export function authGate(
  model: Model,
  props: { readonly title: string; readonly description: string },
  h: Builder,
) {
  return model.viewer.kind === "anonymous"
    ? passkeyGate(model, props, h)
    : sessionCard(model, model.viewer, h);
}

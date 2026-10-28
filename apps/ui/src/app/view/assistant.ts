import { Match, Option } from "effect";
import { alert } from "@effect-coffee-shop/ui-kit/components/alert";
import { button } from "@effect-coffee-shop/ui-kit/components/button";
import { card, cardContent, cardTitleHeader } from "@effect-coffee-shop/ui-kit/components/card";
import { textField } from "@effect-coffee-shop/ui-kit/components/field";
import { progress } from "@effect-coffee-shop/ui-kit/components/progress";
import { text } from "@effect-coffee-shop/ui-kit/components/text";
import type { AssistantState, LocalModelStatus } from "#features/assistant/lib/state.ts";
import type { AssistantTurn } from "#features/assistant/lib/tools.ts";
import { getOrderActions } from "#features/coffee-shop/lib/coffee.ts";
import { getOrderTitle } from "#features/coffee-shop/lib/order-display.ts";
import { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";
import type { Builder } from "#app/view/builder.ts";

const megabytes = (bytes: number): string => `${Math.round(bytes / 1_000_000).toLocaleString()} MB`;

/** A download bar, or a note while the model compiles after the download. */
function loadingBar(label: string, loaded: number, total: number, h: Builder) {
  const isDownloading = total > 0 && loaded < total;
  return h.div(
    [h.Class("grid gap-2"), h.AriaLive("polite")],
    [
      text(
        { className: "text-sm text-muted-foreground" },
        [
          isDownloading
            ? `Downloading ${label}: ${megabytes(loaded)} of ${megabytes(total)}`
            : `Preparing ${label} on your GPU…`,
        ],
        h,
      ),
      progress(total > 0 ? (loaded / total) * 100 : 0, h),
    ],
  );
}

function turnOff(h: Builder) {
  return h.div(
    [h.Class("grid gap-3")],
    [
      text(
        { className: "text-sm text-muted-foreground" },
        [
          "Runs Liquid AI's LFM3-1.7B in this tab with WebGPU. The first start downloads about 1.1 GB, which your browser keeps for next time. Nothing you type leaves this device.",
        ],
        h,
      ),
      h.div(
        [],
        [
          button(
            { attributes: [h.OnClick(Message.ClickedEnableAssistant())] },
            ["Turn on local AI"],
            h,
          ),
        ],
      ),
    ],
  );
}

function failed(message: string, retry: Message, h: Builder) {
  return h.div(
    [h.Class("grid gap-3")],
    [
      alert({ status: "error", title: "Local AI stopped" }, [message], h),
      h.div([], [button({ attributes: [h.OnClick(retry)], variant: "outline" }, ["Try again"], h)]),
    ],
  );
}

const placeholderFor = (model: Model): string =>
  model.route._tag === "Staff"
    ? "Try: mark Ada's latte ready"
    : "Try: a large oat latte with an extra shot";

function promptForm(model: Model, h: Builder) {
  const { assistant } = model;
  const isBusy = assistant.isThinking || assistant.recording !== "idle";
  return h.form(
    [h.Class("flex flex-wrap items-end gap-3"), h.OnSubmit(Message.SubmittedAssistantPrompt())],
    [
      h.div(
        [h.Class("min-w-0 flex-1")],
        [
          textField(
            {
              id: "assistant-prompt",
              label: "Ask the assistant",
              value: assistant.prompt,
              placeholder: placeholderFor(model),
              disabled: isBusy,
              autocomplete: "off",
              onInput: (value) => Message.ChangedAssistantPrompt({ value }),
            },
            h,
          ),
        ],
      ),
      button(
        { type: "submit", disabled: isBusy || assistant.prompt.trim().length === 0 },
        [assistant.isThinking ? "Thinking…" : "Ask"],
        h,
      ),
      ...voiceControl(assistant, h),
    ],
  );
}

function voiceControl(assistant: AssistantState, h: Builder) {
  return Match.value(assistant.voice).pipe(
    Match.tag("Off", () => [
      button(
        { attributes: [h.OnClick(Message.ClickedEnableVoice())], variant: "outline" },
        ["Add voice (≈1.9 GB)"],
        h,
      ),
    ]),
    Match.tag("Ready", () => [
      Match.value(assistant.recording).pipe(
        Match.when("recording", () =>
          button(
            { attributes: [h.OnClick(Message.ClickedStopRecording())], variant: "secondary" },
            ["● Stop"],
            h,
          ),
        ),
        Match.when("transcribing", () =>
          button({ disabled: true, variant: "outline" }, ["Listening…"], h),
        ),
        Match.orElse(() =>
          button(
            {
              attributes: [h.OnClick(Message.ClickedStartRecording())],
              disabled: assistant.isThinking,
              variant: "outline",
            },
            ["🎙 Speak"],
            h,
          ),
        ),
      ),
    ]),
    Match.orElse(() => []),
  );
}

/** Voice loads after text, so its progress and failures show under the prompt. */
function voiceStatus(status: LocalModelStatus, h: Builder) {
  return Match.value(status).pipe(
    Match.tag("Loading", ({ loaded, total }) => [loadingBar("LFM3-Audio-2B", loaded, total, h)]),
    Match.tag("Failed", ({ message }) => [failed(message, Message.ClickedEnableVoice(), h)]),
    Match.orElse(() => []),
  );
}

const actionLabel = (model: Model, orderId: string, action: string): string =>
  Option.fromNullishOr(model.orders.find((order) => order.id === orderId)).pipe(
    Option.map((order) => {
      const option = getOrderActions(order.status).find((entry) => entry.action === action);
      return `${option?.label ?? action}: ${order.customerName}'s ${getOrderTitle(order)}`;
    }),
    Option.getOrElse(() => action),
  );

const dismiss = (h: Builder) =>
  button(
    {
      attributes: [h.OnClick(Message.ClickedDismissAssistantTurn())],
      size: "sm",
      variant: "ghost",
    },
    ["Dismiss"],
    h,
  );

function turnView(model: Model, turn: AssistantTurn, h: Builder) {
  const said = (fallback: string) => (turn.text.length > 0 ? turn.text : fallback);
  const [message, actions] = Match.value(turn).pipe(
    Match.tag("Replied", ({ text: reply }) => [reply, [dismiss(h)]] as const),
    Match.tag(
      "UpdatedDraft",
      () =>
        [
          said("Updated your draft. Check it below, then place the order."),
          [
            ...(Option.isSome(model.assistant.undo)
              ? [
                  button(
                    {
                      attributes: [h.OnClick(Message.ClickedUndoAssistantEdit())],
                      size: "sm",
                      variant: "outline",
                    },
                    ["Undo"],
                    h,
                  ),
                ]
              : []),
            dismiss(h),
          ],
        ] as const,
    ),
    Match.tag(
      "ProposedPlaceOrder",
      () =>
        [
          said("Ready to send this draft to the baristas?"),
          [
            button(
              { attributes: [h.OnClick(Message.ClickedSendOrder())], size: "sm" },
              ["Place order"],
              h,
            ),
            dismiss(h),
          ],
        ] as const,
    ),
    Match.tag(
      "ProposedOrderAction",
      ({ orderId, action }) =>
        [
          said("Here's the next step for that ticket."),
          [
            button(
              {
                attributes: [h.OnClick(Message.ClickedOrderAction({ orderId, action }))],
                size: "sm",
              },
              [actionLabel(model, orderId, action)],
              h,
            ),
            dismiss(h),
          ],
        ] as const,
    ),
    Match.exhaustive,
  );
  return h.div(
    [h.Class("grid gap-3 rounded border-2 border-border bg-background p-3"), h.AriaLive("polite")],
    [text({}, [message], h), h.div([h.Class("flex flex-wrap gap-2")], actions)],
  );
}

function readyBody(model: Model, h: Builder) {
  const { assistant } = model;
  return h.div(
    [h.Class("grid gap-3")],
    [
      promptForm(model, h),
      ...voiceStatus(assistant.voice, h),
      ...Option.match(assistant.heard, {
        onNone: () => [],
        onSome: (heard) => [
          text({ className: "text-sm text-muted-foreground" }, [`Heard: “${heard}”`], h),
        ],
      }),
      ...Option.match(assistant.error, {
        onNone: () => [],
        onSome: (message) => [alert({ status: "warning", title: "Try again" }, [message], h)],
      }),
      ...Option.match(assistant.turn, {
        onNone: () => [],
        onSome: (turn) => [turnView(model, turn, h)],
      }),
    ],
  );
}

/** The on-device assistant: off, loading, ready for typed or spoken requests, or failed. */
export function assistantCard(model: Model, h: Builder) {
  const body = Match.value(model.assistant.text).pipe(
    Match.tag("Off", () => turnOff(h)),
    Match.tag("Loading", ({ loaded, total }) => loadingBar("LFM3-1.7B", loaded, total, h)),
    Match.tag("Failed", ({ message }) => failed(message, Message.ClickedEnableAssistant(), h)),
    Match.tag("Ready", () => readyBody(model, h)),
    Match.exhaustive,
  );
  return card(
    { className: "w-full" },
    [
      cardTitleHeader(
        "Local AI",
        model.route._tag === "Staff"
          ? "Move tickets along by asking. Every change waits for your tap."
          : "Describe your drink and the assistant fills in the order. Sending it waits for your tap.",
        h,
      ),
      cardContent({}, [body], h),
    ],
    h,
  );
}

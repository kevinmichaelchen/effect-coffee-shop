import type { HtmlBuilder } from "foldkit/html";
import { Button, Input, Select } from "@foldkit/ui";
import { Model } from "./model.ts";
import { Message } from "./message.ts";
import { DraftField } from "./data.ts";
export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export const button = (
  label: string,
  message: Message,
  h: HtmlBuilder<Message>,
  disabled = false,
) =>
  Button.view(
    {
      onClick: message,
      isDisabled: disabled,
      toView: (attributes) => h.button(attributes.button, [label]),
    },
    h,
  );
export const field =
  (label: string, id: string, value: string, onInput: (value: string) => Message) =>
  (h: HtmlBuilder<Message>) =>
    Input.view(
      {
        id,
        value,
        onInput,
        toView: (a) => h.div([h.Class("field")], [h.label(a.label, [label]), h.input(a.input)]),
      },
      h,
    );
export const select =
  (label: string, field: typeof DraftField.Type, choices: readonly string[], model: Model) =>
  (h: HtmlBuilder<Message>) =>
    Select.view(
      {
        id: field,
        value: model.draft[field],
        onChange: (value) => Message.ChangedDraft({ field, value }),
        toView: (a) =>
          h.div(
            [h.Class("field")],
            [
              h.label(a.label, [label]),
              h.select(
                a.select,
                choices.map((value) => h.option([h.Value(value)], [value])),
              ),
            ],
          ),
      },
      h,
    );

import type { HtmlBuilder } from "foldkit/html";
import { cn } from "#ui/lib/utils.ts";
import { text } from "#ui/components/text.ts";

const labelClass = "font-head text-sm uppercase tracking-[0.08em]";
const controlClass =
  "px-4 py-2 w-full rounded border-2 shadow-md transition focus:outline-hidden focus:shadow-xs";

export interface SelectOption {
  readonly label: string;
  readonly value: string;
}

interface FieldBase {
  readonly id: string;
  readonly label: string;
  readonly helperText?: string | undefined;
}

function helper<Message>(field: FieldBase, h: HtmlBuilder<Message>) {
  return field.helperText === undefined
    ? []
    : [
        text(
          {
            attributes: [h.Id(`${field.id}-help`)],
            className: "text-sm text-muted-foreground",
          },
          [field.helperText],
          h,
        ),
      ];
}

function describedBy<Message>(field: FieldBase, h: HtmlBuilder<Message>) {
  return field.helperText === undefined ? [] : [h.AriaDescribedBy(`${field.id}-help`)];
}

export interface TextFieldProps<Message> extends FieldBase {
  readonly value: string;
  readonly onInput: (value: string) => Message;
  readonly type?: "text" | "number";
  readonly placeholder?: string;
  readonly min?: number;
  readonly max?: number;
  readonly disabled?: boolean;
  readonly autocomplete?: string;
}

function optionalAttributes<Message>(props: TextFieldProps<Message>, h: HtmlBuilder<Message>) {
  return [
    ...(props.placeholder === undefined ? [] : [h.Placeholder(props.placeholder)]),
    ...(props.min === undefined ? [] : [h.Min(String(props.min))]),
    ...(props.max === undefined ? [] : [h.Max(String(props.max))]),
    ...(props.autocomplete === undefined ? [] : [h.Autocomplete(props.autocomplete)]),
  ];
}

export function textField<Message>(props: TextFieldProps<Message>, h: HtmlBuilder<Message>) {
  return h.div(
    [h.Class("grid gap-2")],
    [
      h.label([h.For(props.id), h.Class(labelClass)], [props.label]),
      h.input([
        h.Id(props.id),
        h.Type(props.type ?? "text"),
        h.Value(props.value),
        h.Disabled(props.disabled ?? false),
        h.OnInput(props.onInput),
        ...optionalAttributes(props, h),
        ...describedBy(props, h),
        h.Class(controlClass),
      ]),
      ...helper(props, h),
    ],
  );
}

export interface TextAreaFieldProps<Message> extends FieldBase {
  readonly value: string;
  readonly placeholder: string;
  readonly onInput: (value: string) => Message;
}

export function textAreaField<Message>(
  props: TextAreaFieldProps<Message>,
  h: HtmlBuilder<Message>,
) {
  return h.div(
    [h.Class("grid gap-2")],
    [
      h.label([h.For(props.id), h.Class(labelClass)], [props.label]),
      h.textarea([
        h.Id(props.id),
        h.Rows(4),
        h.Value(props.value),
        h.Placeholder(props.placeholder),
        h.OnInput(props.onInput),
        ...describedBy(props, h),
        h.Class(
          cn(
            "w-full resize-y overflow-y-auto rounded border-2 border-border px-4 py-2 shadow-md transition focus:outline-hidden focus:shadow-xs placeholder:text-muted-foreground",
          ),
        ),
      ]),
      ...helper(props, h),
    ],
  );
}

export interface SelectFieldProps<Message> extends FieldBase {
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => Message;
}

/** A native select: keyboard, typeahead, and screen-reader support come from the browser. */
export function selectField<Message>(props: SelectFieldProps<Message>, h: HtmlBuilder<Message>) {
  return h.div(
    [h.Class("grid gap-2")],
    [
      h.label([h.For(props.id), h.Class(labelClass)], [props.label]),
      h.select(
        [
          h.Id(props.id),
          h.OnChange(props.onChange),
          ...describedBy(props, h),
          h.Class(cn(controlClass, "bg-background")),
        ],
        props.options.map((option) =>
          h.option(
            [h.Value(option.value), h.Selected(option.value === props.value)],
            [option.label],
          ),
        ),
      ),
      ...helper(props, h),
    ],
  );
}

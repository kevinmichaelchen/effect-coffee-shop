import type { HtmlBuilder } from "foldkit/html";
import { cn } from "#ui/lib/utils.ts";
import type { Attributes, Child } from "#ui/components/types.ts";

interface CellProps<Message> {
  readonly className?: string;
  readonly attributes?: Attributes<Message>;
}

export function table<Message>(
  header: readonly Child[],
  rows: readonly Child[],
  h: HtmlBuilder<Message>,
) {
  return h.table(
    [h.Class("w-full border-2 border-border text-left text-sm")],
    [h.thead([h.Class("bg-muted")], [h.tr([], header)]), h.tbody([], rows)],
  );
}

export function tableHead<Message>(label: string, h: HtmlBuilder<Message>) {
  return h.th([h.Class("px-4 py-2 font-head font-medium")], [label]);
}

/** Rows are keyed so a refresh that reorders tickets never moves focus onto another ticket. */
export function tableRow<Message>(key: string, cells: readonly Child[], h: HtmlBuilder<Message>) {
  return h.keyed("tr")(key, [h.Class("border-t-2 border-border")], cells);
}

export function tableCell<Message>(
  props: CellProps<Message>,
  children: readonly Child[],
  h: HtmlBuilder<Message>,
) {
  return h.td(
    [...(props.attributes ?? []), h.Class(cn("px-4 py-2 align-top", props.className))],
    children,
  );
}

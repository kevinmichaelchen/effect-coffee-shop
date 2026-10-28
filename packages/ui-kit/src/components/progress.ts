import type { HtmlBuilder } from "foldkit/html";

/** A 0-100 progress bar. The width carries the value, so no inline style is needed. */
export function progress<Message>(value: number, h: HtmlBuilder<Message>) {
  const clamped = Math.min(Math.max(Math.round(value), 0), 100);
  return h.progress(
    [
      h.Max("100"),
      h.Value(String(clamped)),
      h.AriaLabel("Progress"),
      h.Class(
        "h-1.5 w-full appearance-none overflow-hidden border-2 bg-background [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-background [&::-webkit-progress-value]:bg-primary",
      ),
    ],
    [],
  );
}

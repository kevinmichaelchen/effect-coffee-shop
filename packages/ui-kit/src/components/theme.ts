import { Schema } from "effect";
import type { Attributes } from "#ui/components/types.ts";
import type { HtmlBuilder } from "foldkit/html";
import { button } from "#ui/components/button.ts";

export const ThemePreference = Schema.Literals(["light", "dark"]);
export type ThemePreference = typeof ThemePreference.Type;

export const themeStorageKey = "coffee-shop-theme";

export const toggledTheme = (theme: ThemePreference): ThemePreference =>
  theme === "light" ? "dark" : "light";

export function themeToggle<Message>(
  props: {
    readonly theme: ThemePreference;
    readonly compact?: boolean;
    readonly onToggle: Message;
  },
  h: HtmlBuilder<Message>,
) {
  const isDark = props.theme === "dark";
  const label = isDark ? "Switch to light" : "Switch to dark";
  const glyph = isDark ? "☀" : "☾";
  const attributes: Attributes<Message> = [h.OnClick(props.onToggle), h.Title(label)];

  return props.compact === true
    ? button(
        { attributes: [...attributes, h.AriaLabel(label)], size: "icon", variant: "outline" },
        [glyph],
        h,
      )
    : button({ attributes, size: "md", variant: "outline" }, [`${glyph} ${label}`], h);
}

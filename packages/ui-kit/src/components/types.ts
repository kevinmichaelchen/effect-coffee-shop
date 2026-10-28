import type { Html, HtmlBuilder } from "foldkit/html";

/** A child of a view element: rendered HTML or plain text. */
export type Child = Html | string;

/** Extra attributes a caller may add to a primitive (events, ids, aria, Submodel bundles). */
export type Attributes<Message> = Parameters<HtmlBuilder<Message>["div"]>[0];

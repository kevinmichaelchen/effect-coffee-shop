import type { HtmlBuilder } from "foldkit/html";
import type { Message } from "#app/message.ts";

/** The element builder every view receives, bound to this app's messages. */
export type Builder = HtmlBuilder<Message>;

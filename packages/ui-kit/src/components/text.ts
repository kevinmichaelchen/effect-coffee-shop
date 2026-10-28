import { cva, type VariantProps } from "class-variance-authority";
import type { HtmlBuilder } from "foldkit/html";
import { cn } from "#ui/lib/utils.ts";
import type { Attributes, Child } from "#ui/components/types.ts";

const textVariants = cva("font-head", {
  variants: {
    as: {
      p: "font-sans text-base",
      h1: "text-4xl lg:text-5xl font-bold",
      h2: "text-3xl lg:text-4xl font-semibold",
      h3: "text-2xl font-medium",
      h4: "text-xl font-normal",
      h5: "text-lg font-normal",
    },
  },
  defaultVariants: { as: "p" },
});

export type TextTag = NonNullable<VariantProps<typeof textVariants>["as"]>;

export interface TextProps<Message> {
  readonly as?: TextTag;
  readonly className?: string;
  readonly attributes?: Attributes<Message>;
}

/** Typography primitive: pick the element with `as`, style comes from the kit. */
export function text<Message>(
  props: TextProps<Message>,
  children: readonly Child[],
  h: HtmlBuilder<Message>,
) {
  const tag = props.as ?? "p";
  const attributes = [
    ...(props.attributes ?? []),
    h.Class(cn(textVariants({ as: tag }), props.className)),
  ];
  return h[tag](attributes, children);
}

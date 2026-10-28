import { cva, type VariantProps } from "class-variance-authority";
import type { HtmlBuilder } from "foldkit/html";
import { cn } from "#ui/lib/utils.ts";
import type { Attributes, Child } from "#ui/components/types.ts";
import { text } from "#ui/components/text.ts";

const cardVariants = cva(
  "inline-block border-2 rounded shadow-md transition-all hover:shadow-none",
  {
    variants: { surface: { card: "bg-card", background: "bg-background" } },
    defaultVariants: { surface: "card" },
  },
);

export type CardSurface = NonNullable<VariantProps<typeof cardVariants>["surface"]>;

export interface CardProps<Message> {
  readonly surface?: CardSurface;
  readonly className?: string;
  readonly attributes?: Attributes<Message>;
}

export function card<Message>(
  props: CardProps<Message>,
  children: readonly Child[],
  h: HtmlBuilder<Message>,
) {
  return h.div(
    [
      ...(props.attributes ?? []),
      h.Class(cn(cardVariants({ surface: props.surface }), props.className)),
    ],
    children,
  );
}

export function cardHeader<Message>(
  props: { readonly className?: string },
  children: readonly Child[],
  h: HtmlBuilder<Message>,
) {
  return h.div([h.Class(cn("flex flex-col justify-start p-4", props.className))], children);
}

export function cardContent<Message>(
  props: { readonly className?: string },
  children: readonly Child[],
  h: HtmlBuilder<Message>,
) {
  return h.div([h.Class(cn("p-4", props.className))], children);
}

/** A card header with a title and an optional muted description. */
export function cardTitleHeader<Message>(
  title: string,
  description: string | undefined,
  h: HtmlBuilder<Message>,
) {
  return cardHeader(
    { className: "border-b border-border" },
    [
      text({ as: "h3" }, [title], h),
      ...(description === undefined
        ? []
        : [text({ className: "text-sm text-muted-foreground" }, [description], h)]),
    ],
    h,
  );
}

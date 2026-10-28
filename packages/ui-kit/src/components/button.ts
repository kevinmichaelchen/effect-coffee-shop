import { cva, type VariantProps } from "class-variance-authority";
import type { HtmlBuilder } from "foldkit/html";
import { cn } from "#ui/lib/utils.ts";
import type { Attributes, Child } from "#ui/components/types.ts";

const buttonVariants = cva(
  "font-head transition-all rounded outline-hidden cursor-pointer duration-200 font-medium flex items-center disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "shadow-md hover:shadow active:shadow-none bg-primary text-primary-foreground border-2 border-black transition hover:translate-y-1 active:translate-y-2 active:translate-x-1 hover:bg-primary-hover",
        secondary:
          "shadow-md hover:shadow active:shadow-none bg-secondary shadow-primary text-secondary-foreground border-2 border-black transition hover:translate-y-1 active:translate-y-2 active:translate-x-1 hover:bg-secondary-hover",
        outline:
          "shadow-md hover:shadow active:shadow-none bg-transparent border-2 transition hover:translate-y-1 active:translate-y-2 active:translate-x-1",
        link: "bg-transparent hover:underline",
        ghost: "bg-transparent hover:bg-accent",
      },
      size: {
        sm: "px-3 py-1 text-sm shadow hover:shadow-none",
        md: "px-4 py-1.5 text-base",
        lg: "px-6 lg:px-8 py-2 lg:py-3 text-base lg:text-lg",
        icon: "p-2",
      },
    },
    defaultVariants: { size: "md", variant: "default" },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

export interface ButtonProps<Message> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly attributes?: Attributes<Message>;
}

function classFor<Message>(props: ButtonProps<Message>) {
  return cn(buttonVariants({ size: props.size, variant: props.variant }), props.className);
}

export function button<Message>(
  props: ButtonProps<Message>,
  children: readonly Child[],
  h: HtmlBuilder<Message>,
) {
  return h.button(
    [
      h.Type("button"),
      h.Disabled(props.disabled ?? false),
      ...(props.attributes ?? []),
      h.Class(classFor(props)),
    ],
    children,
  );
}

/** A link that looks like a button. Navigation stays a real anchor. */
export function linkButton<Message>(
  props: ButtonProps<Message> & { readonly href: string },
  children: readonly Child[],
  h: HtmlBuilder<Message>,
) {
  return h.a([h.Href(props.href), ...(props.attributes ?? []), h.Class(classFor(props))], children);
}

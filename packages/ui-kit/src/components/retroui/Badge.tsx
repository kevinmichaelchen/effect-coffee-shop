import { cn } from "#ui/lib/utils.ts";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

const badgeVariants = cva("font-semibold rounded", {
  variants: {
    variant: {
      default: "bg-muted text-muted-foreground",
      outline: "outline-2 outline-foreground text-foreground",
      solid: "bg-foreground text-background",
      surface: "outline-2 bg-primary text-primary-foreground",
      primary: "bg-primary text-primary-foreground",
      warning:
        "bg-status-brewing text-status-brewing-foreground dark:bg-status-brewing-foreground/40 dark:text-status-brewing",
      success:
        "bg-status-ready text-status-ready-foreground dark:bg-status-ready-foreground/40 dark:text-status-ready",
      danger:
        "bg-status-cancelled text-status-cancelled-foreground dark:bg-status-cancelled-foreground/40 dark:text-status-cancelled",
    },
    size: {
      sm: "px-2 py-1 text-xs",
      pill: "rounded-full px-2.5 py-1 text-xs font-medium",
      md: "px-2.5 py-1.5 text-sm",
      lg: "px-3 py-2 text-base",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

export interface ButtonProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({
  children,
  size = "md",
  variant = "default",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {children}
    </span>
  );
}

import type { HTMLAttributes } from "react";
import { cn } from "#lib/utils";

const sizeStyles = {
  sm: "size-3",
  md: "size-4",
  lg: "size-5",
} as const;

interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: keyof typeof sizeStyles;
}

export function Spinner({
  className = "",
  size = "md",
  ...props
}: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block rounded-none border-2 border-current border-r-transparent motion-safe:animate-spin",
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  );
}

import type { TextareaHTMLAttributes } from "react";
import { cn } from "#shared/lib/utils.ts";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export function Textarea({
  placeholder = "Enter text...",
  className = "",
  rows = 4,
  ...props
}: TextareaProps) {
  return (
    <textarea
      placeholder={placeholder}
      rows={rows}
      className={cn(
        "w-full resize-y overflow-y-auto rounded border-2 border-border px-4 py-2 shadow-md transition focus:outline-hidden focus:shadow-xs placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

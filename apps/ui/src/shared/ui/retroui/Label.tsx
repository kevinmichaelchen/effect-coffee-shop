import * as LabelPrimitive from "@radix-ui/react-label";
import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "#shared/lib/utils.ts";

const labelVariants = cva("leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");

export const Label = ({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) => (
  <LabelPrimitive.Root className={cn(labelVariants(), className)} {...props} />
);

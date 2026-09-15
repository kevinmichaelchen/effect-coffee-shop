import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#shared/lib/utils.ts";
import { Text } from "#shared/ui/retroui/Text.tsx";

const alertVariants = cva("relative w-full rounded border-2 p-4", {
  variants: {
    variant: {
      default: "bg-background text-foreground [&_svg]:shrink-0",
      solid: "bg-black text-white",
    },
    status: {
      error: "bg-alert-error text-alert-error-foreground border-alert-error-foreground",
      success: "bg-alert-success text-alert-success-foreground border-alert-success-foreground",
      warning: "bg-alert-warning text-alert-warning-foreground border-alert-warning-foreground",
      info: "bg-alert-info text-alert-info-foreground border-alert-info-foreground",
    },
    surface: {
      status: "",
      card: "bg-card border-border",
      background: "bg-background border-border",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface IAlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

const Alert = ({ className, variant, status, surface, ...props }: IAlertProps) => (
  <div
    role="alert"
    className={cn(alertVariants({ variant, status, surface }), className)}
    {...props}
  />
);
Alert.displayName = "Alert";

type IAlertTitleProps = HTMLAttributes<HTMLHeadingElement>;
const AlertTitle = ({ className, ...props }: IAlertTitleProps) => (
  <Text as="h5" className={cn(className)} {...props} />
);
AlertTitle.displayName = "AlertTitle";

type IAlertDescriptionProps = HTMLAttributes<HTMLParagraphElement>;
const AlertDescription = ({ className, ...props }: IAlertDescriptionProps) => (
  <div className={cn("text-muted-foreground", className)} {...props} />
);

AlertDescription.displayName = "AlertDescription";

const AlertComponent = Object.assign(Alert, {
  Title: AlertTitle,
  Description: AlertDescription,
});

export { AlertComponent as Alert };

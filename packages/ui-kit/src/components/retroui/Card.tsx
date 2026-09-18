import { cn } from "#ui/lib/utils.ts";
import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Text } from "#ui/components/retroui/Text.tsx";

interface ICardProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const cardVariants = cva(
  "inline-block border-2 rounded shadow-md transition-all hover:shadow-none",
  {
    variants: { surface: { card: "bg-card", background: "bg-background" } },
    defaultVariants: { surface: "card" },
  },
);

const Card = ({ className, surface, ...props }: ICardProps & VariantProps<typeof cardVariants>) => {
  return <div className={cn(cardVariants({ surface }), className)} {...props} />;
};

const CardHeader = ({ className, ...props }: ICardProps) => {
  return <div className={cn("flex flex-col justify-start p-4", className)} {...props} />;
};

const CardTitle = ({ className, ...props }: ICardProps) => {
  return <Text as="h3" className={cn("mb-2", className)} {...props} />;
};

const CardDescription = ({ className, ...props }: ICardProps) => (
  <p className={cn("text-muted-foreground", className)} {...props} />
);

const CardContent = ({ className, ...props }: ICardProps) => {
  return <div className={cn("p-4", className)} {...props} />;
};

const CardComponent = Object.assign(Card, {
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Content: CardContent,
});

export { CardComponent as Card };

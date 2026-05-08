import { Button } from "#shared/ui/retroui/Button.tsx";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { formatPrice } from "#features/coffee-shop/lib/coffee.ts";
import type { MenuItem, OrderDraft } from "#features/coffee-shop/lib/coffee.ts";

interface OrderPreviewProps {
  draft: OrderDraft;
  item: MenuItem;
  pending: boolean;
  priceCents: number;
  onSubmit: () => void;
}

export function OrderPreview(inputProps: OrderPreviewProps) {
  const { draft, item, pending, priceCents, onSubmit } = inputProps;

  return (
    <Card className="bg-background">
      <Card.Content className="grid gap-4 p-4">
        <div className="grid gap-2">
          <Text as="p" className="text-xs text-muted-foreground">
            Summary
          </Text>
          <Text as="h3" className="text-xl font-semibold">
            {item.name}
          </Text>
          <Text as="p" className="text-sm text-muted-foreground">
            {draft.size}, {draft.temperature}, {draft.milk} milk, {draft.shots} shot(s)
          </Text>
        </div>
        <Text as="h2" className="text-3xl font-semibold">
          {formatPrice(priceCents)}
        </Text>
        <Button className="justify-center" disabled={pending} onClick={onSubmit}>
          {pending ? "Sending order…" : "Send to queue"}
        </Button>
      </Card.Content>
    </Card>
  );
}

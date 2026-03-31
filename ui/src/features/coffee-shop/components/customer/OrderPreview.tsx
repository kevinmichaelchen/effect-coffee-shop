import { Alert } from "#shared/ui/retroui/Alert.tsx";
import { Badge } from "#shared/ui/retroui/Badge.tsx";
import { Button } from "#shared/ui/retroui/Button.tsx";
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
    <Alert variant="solid" className="grid gap-4 p-5">
      <Badge className="w-fit rounded-none bg-white px-2.5 py-1 text-black" size="sm">
        Live preview
      </Badge>
      <div className="grid gap-2">
        <Text as="h3">{item.name}</Text>
        <Text as="p" className="text-sm text-white/80">
          {draft.size}, {draft.temperature}, {draft.milk} milk, {draft.shots} shot(s)
        </Text>
      </div>
      <Text as="h2" className="text-4xl">
        {formatPrice(priceCents)}
      </Text>
      <Text as="p" className="text-sm text-white/80">
        Tickets open in the queue instantly and land in the barista board on the right.
      </Text>
      <Button disabled={pending} variant="outline" className="justify-center bg-white text-black" onClick={onSubmit}>
        {pending ? "Sending order…" : "Send to queue"}
      </Button>
    </Alert>
  );
}

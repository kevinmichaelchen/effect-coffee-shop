import { Card } from "#shared/ui/retroui/Card.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { OrderFields } from "#features/coffee-shop/components/customer/OrderFields.tsx";
import { OrderPreview } from "#features/coffee-shop/components/customer/OrderPreview.tsx";
import type { MenuItem, OrderDraft } from "#features/coffee-shop/lib/coffee.ts";

interface OrderComposerCardProps {
  draft: OrderDraft;
  item: MenuItem;
  menu: readonly MenuItem[];
  pending: boolean;
  priceCents: number;
  onSelectDrink: (drinkId: string) => void;
  onSubmit: () => void;
  onUpdateDraft: <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => void;
}

export function OrderComposerCard(inputProps: OrderComposerCardProps) {
  const { draft, item, menu, pending, priceCents, onSelectDrink, onSubmit, onUpdateDraft } = inputProps;

  return (
    <Card className="w-full border-border">
      <Card.Header className="border-b-2 border-border bg-card">
        <Text as="h3">Build an order</Text>
        <Text as="p" className="text-sm text-muted-foreground">
          The form honors the backend’s milk, temperature, and shot limits for each drink.
        </Text>
      </Card.Header>
      <Card.Content className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <OrderFields
          draft={draft}
          item={item}
          menu={menu}
          onSelectDrink={onSelectDrink}
          onUpdateDraft={onUpdateDraft}
        />
        <OrderPreview draft={draft} item={item} pending={pending} priceCents={priceCents} onSubmit={onSubmit} />
      </Card.Content>
    </Card>
  );
}

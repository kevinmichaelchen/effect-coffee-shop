import { Alert } from "#shared/ui/retroui/Alert.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { OrderComposerCard } from "#features/coffee-shop/components/customer/OrderComposerCard.tsx";
import type { MenuItem, OrderDraft } from "#features/coffee-shop/lib/coffee.ts";

interface CustomerPanelProps {
  draft: OrderDraft | null;
  menu: readonly MenuItem[];
  pending: boolean;
  priceCents: number;
  selectedItem: MenuItem | undefined;
  onSelectDrink: (drinkId: string) => void;
  onSubmit: () => void;
  onUpdateDraft: <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => void;
}

export function CustomerPanel(inputProps: CustomerPanelProps) {
  const { draft, menu, pending, priceCents, selectedItem, onSelectDrink, onSubmit, onUpdateDraft } =
    inputProps;

  if (draft === null || selectedItem === undefined) {
    return (
      <Alert className="border-border bg-card" status="info">
        <Alert.Title>Loading customer tools</Alert.Title>
        <Text as="p" className="text-sm text-muted-foreground">
          Waiting for the menu to arrive from the backend.
        </Text>
      </Alert>
    );
  }

  return (
    <section className="grid gap-5">
      <OrderComposerCard
        draft={draft}
        item={selectedItem}
        menu={menu}
        pending={pending}
        priceCents={priceCents}
        onSelectDrink={onSelectDrink}
        onSubmit={onSubmit}
        onUpdateDraft={onUpdateDraft}
      />
    </section>
  );
}

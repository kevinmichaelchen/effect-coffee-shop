import { Card } from "#shared/ui/retroui/Card.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { MenuItemCard } from "#features/coffee-shop/components/customer/MenuItemCard.tsx";
import type { MenuItem } from "#features/coffee-shop/lib/coffee.ts";

interface MenuCatalogCardProps {
  menu: readonly MenuItem[];
  selectedDrinkId: string;
  onSelectDrink: (drinkId: string) => void;
}

export function MenuCatalogCard(inputProps: MenuCatalogCardProps) {
  const { menu, selectedDrinkId, onSelectDrink } = inputProps;

  return (
    <Card className="w-full border-border">
      <Card.Header className="border-b-2 border-border bg-secondary text-secondary-foreground">
        <Text as="h3">Menu catalog</Text>
        <Text as="p" className="text-sm text-secondary-foreground/80">
          Pick a base drink and the form syncs its supported options automatically.
        </Text>
      </Card.Header>
      <Card.Content className="grid gap-4 md:grid-cols-2">
        {menu.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            selected={item.id === selectedDrinkId}
            onSelect={onSelectDrink}
          />
        ))}
      </Card.Content>
    </Card>
  );
}

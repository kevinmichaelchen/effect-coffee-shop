import { Badge } from "#components/retroui/Badge";
import { Button } from "#components/retroui/Button";
import { Card } from "#components/retroui/Card";
import { Text } from "#components/retroui/Text";
import { formatPrice } from "#lib/coffee";
import type { MenuItem } from "#lib/coffee";

interface MenuItemCardProps {
  item: MenuItem;
  selected: boolean;
  onSelect: (drinkId: string) => void;
}

export function MenuItemCard({ item, selected, onSelect }: MenuItemCardProps) {
  return (
    <Card
      className={selected ? "w-full border-black bg-accent text-accent-foreground" : "w-full border-border"}
    >
      <Card.Header className="gap-3 border-b-2 border-dashed border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <Text as="h4">{item.name}</Text>
            <Text as="p" className="text-sm text-muted-foreground">
              {item.kind === "tea" ? "Tea service" : "Espresso base"}
            </Text>
          </div>
          <Badge className="rounded-none" size="sm" variant={selected ? "solid" : "outline"}>
            {formatPrice(item.basePriceCents)}
          </Badge>
        </div>
      </Card.Header>
      <Card.Content className="grid gap-4">
        <Text as="p" className="text-sm text-muted-foreground">
          Milks: {item.availableMilks.join(", ")}. Temps: {item.availableTemperatures.join(", ")}.
        </Text>
        <Button variant={selected ? "secondary" : "outline"} onClick={() => onSelect(item.id)}>
          {selected ? "Selected" : "Choose drink"}
        </Button>
      </Card.Content>
    </Card>
  );
}

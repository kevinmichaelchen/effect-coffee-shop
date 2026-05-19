import { Button } from "#shared/ui/retroui/Button.tsx";
import { SelectField } from "#shared/ui/SelectField.tsx";
import { TextAreaField } from "#shared/ui/TextAreaField.tsx";
import type { MenuItem, OrderDraft } from "#features/coffee-shop/lib/coffee.ts";
import { CustomizationFields } from "./CustomizationFields.tsx";

interface OrderFieldsProps {
  draft: OrderDraft;
  item: MenuItem;
  menu: readonly MenuItem[];
  onSelectDrink: (drinkId: string) => void;
  onUpdateDraft: <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => void;
}

export function OrderFields(inputProps: OrderFieldsProps) {
  const { draft, item, menu, onSelectDrink, onUpdateDraft } = inputProps;

  return (
    <div className="grid gap-4">
      <DrinkPicker menu={menu} selectedDrinkId={draft.drinkId} onSelectDrink={onSelectDrink} />
      <SelectField
        label="Drink"
        options={menu.map((menuItem) => ({ label: menuItem.name, value: menuItem.id }))}
        value={draft.drinkId}
        onChange={onSelectDrink}
      />
      <CustomizationFields draft={draft} item={item} onUpdateDraft={onUpdateDraft} />
      <TextAreaField
        helperText="Optional barista note."
        label="Notes"
        placeholder="No lid, extra dry, quick pickup..."
        value={draft.notes}
        onChange={(value) => onUpdateDraft("notes", value)}
      />
    </div>
  );
}

function DrinkPicker({ menu, selectedDrinkId, onSelectDrink }: DrinkPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {menu.map((menuItem) => (
        <Button
          key={menuItem.id}
          size="sm"
          variant={menuItem.id === selectedDrinkId ? "secondary" : "outline"}
          onClick={() => onSelectDrink(menuItem.id)}
        >
          {menuItem.name}
        </Button>
      ))}
    </div>
  );
}

interface DrinkPickerProps {
  menu: readonly MenuItem[];
  selectedDrinkId: string;
  onSelectDrink: (drinkId: string) => void;
}

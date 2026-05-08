import type { ReactNode } from "react";
import { Button } from "#shared/ui/retroui/Button.tsx";
import { SelectField } from "#shared/ui/SelectField.tsx";
import { TextField } from "#shared/ui/TextField.tsx";
import { TextAreaField } from "#shared/ui/TextAreaField.tsx";
import { drinkSizes } from "#features/coffee-shop/lib/coffee.ts";
import type { MenuItem, OrderDraft } from "#features/coffee-shop/lib/coffee.ts";

function toLabel(value: string): string {
  return value.replaceAll("-", " ");
}

interface OrderFieldsProps {
  draft: OrderDraft;
  item: MenuItem;
  menu: readonly MenuItem[];
  onSelectDrink: (drinkId: string) => void;
  onUpdateDraft: <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => void;
}

interface CustomizationFieldsProps {
  draft: OrderDraft;
  item: MenuItem;
  onUpdateDraft: OrderFieldsProps["onUpdateDraft"];
}

function FieldCell({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function SizeField({
  draft,
  onUpdateDraft,
}: Pick<CustomizationFieldsProps, "draft" | "onUpdateDraft">) {
  return (
    <SelectField
      label="Size"
      options={drinkSizes.map((value) => ({
        label: toLabel(value),
        value,
      }))}
      value={draft.size}
      onChange={(value) => onUpdateDraft("size", value)}
    />
  );
}

function MilkField({ draft, item, onUpdateDraft }: CustomizationFieldsProps) {
  return (
    <SelectField
      label="Milk"
      options={item.availableMilks.map((value) => ({ label: toLabel(value), value }))}
      value={draft.milk}
      onChange={(value) => onUpdateDraft("milk", value)}
    />
  );
}

function TemperatureField({ draft, item, onUpdateDraft }: CustomizationFieldsProps) {
  return (
    <SelectField
      label="Temperature"
      options={item.availableTemperatures.map((value) => ({ label: toLabel(value), value }))}
      value={draft.temperature}
      onChange={(value) => onUpdateDraft("temperature", value)}
    />
  );
}

function ShotsField({ draft, item, onUpdateDraft }: CustomizationFieldsProps) {
  return (
    <TextField
      disabled={item.kind === "tea"}
      helperText={item.kind === "tea" ? "Tea stays at zero shots." : `Max ${item.maxShots} shots`}
      label="Shots"
      max={item.maxShots}
      min={0}
      type="number"
      value={draft.shots}
      onChange={(value: string) => onUpdateDraft("shots", Number.parseInt(value || "0", 10) || 0)}
    />
  );
}

function CustomizationFields(inputProps: CustomizationFieldsProps) {
  const { draft, item, onUpdateDraft } = inputProps;

  return (
    <>
      <FieldRow>
        <FieldCell>
          <SizeField draft={draft} onUpdateDraft={onUpdateDraft} />
        </FieldCell>
        <FieldCell>
          <MilkField draft={draft} item={item} onUpdateDraft={onUpdateDraft} />
        </FieldCell>
      </FieldRow>
      <FieldRow>
        <FieldCell>
          <TemperatureField draft={draft} item={item} onUpdateDraft={onUpdateDraft} />
        </FieldCell>
        <FieldCell>
          <ShotsField draft={draft} item={item} onUpdateDraft={onUpdateDraft} />
        </FieldCell>
      </FieldRow>
    </>
  );
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

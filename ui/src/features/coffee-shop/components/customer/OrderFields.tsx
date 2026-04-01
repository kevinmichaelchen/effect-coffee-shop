import type { ReactNode } from "react";
import { SelectField } from "#shared/ui/SelectField.tsx";
import { TextAreaField } from "#shared/ui/TextAreaField.tsx";
import { TextField } from "#shared/ui/TextField.tsx";
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

function CustomizationFields(inputProps: CustomizationFieldsProps) {
  const { draft, item, onUpdateDraft } = inputProps;

  return (
    <>
      <FieldRow>
        <FieldCell>
          <SelectField
            label="Size"
            options={["small", "medium", "large"].map((value) => ({ label: toLabel(value), value }))}
            value={draft.size}
            onChange={(value) => onUpdateDraft("size", value as OrderDraft["size"])}
          />
        </FieldCell>
        <FieldCell>
          <SelectField
            label="Milk"
            options={item.availableMilks.map((value) => ({ label: toLabel(value), value }))}
            value={draft.milk}
            onChange={(value) => onUpdateDraft("milk", value as OrderDraft["milk"])}
          />
        </FieldCell>
      </FieldRow>
      <FieldRow>
        <FieldCell>
          <SelectField
            label="Temperature"
            options={item.availableTemperatures.map((value) => ({ label: toLabel(value), value }))}
            value={draft.temperature}
            onChange={(value) => onUpdateDraft("temperature", value as OrderDraft["temperature"])}
          />
        </FieldCell>
        <FieldCell>
          <TextField
            disabled={item.kind === "tea"}
            helperText={item.kind === "tea" ? "Tea stays at zero shots." : `Max ${item.maxShots} shots`}
            label="Shots"
            max={item.maxShots}
            min={0}
            type="number"
            value={draft.shots}
            onChange={(value) => onUpdateDraft("shots", Number.parseInt(value || "0", 10) || 0)}
          />
        </FieldCell>
      </FieldRow>
    </>
  );
}

export function OrderFields(inputProps: OrderFieldsProps) {
  const { draft, item, menu, onSelectDrink, onUpdateDraft } = inputProps;

  return (
    <div className="grid gap-4">
      <TextField
        label="Customer name"
        placeholder="Taylor"
        value={draft.customerName}
        onChange={(value) => onUpdateDraft("customerName", value)}
      />
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

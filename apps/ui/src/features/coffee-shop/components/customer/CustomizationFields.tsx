import type { ReactNode } from "react";
import { SelectField } from "#shared/ui/SelectField.tsx";
import { TextField } from "#shared/ui/TextField.tsx";
import { drinkSizes } from "#features/coffee-shop/lib/coffee.ts";
import type { MenuItem, OrderDraft } from "#features/coffee-shop/lib/coffee.ts";

interface CustomizationFieldsProps {
  draft: OrderDraft;
  item: MenuItem;
  onUpdateDraft: <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => void;
}

type CustomizationSelectKey = "milk" | "size" | "temperature";

interface CustomizationSelectFieldProps<TKey extends CustomizationSelectKey> {
  draft: Pick<OrderDraft, TKey>;
  field: TKey;
  label: string;
  options: readonly OrderDraft[TKey][];
  onUpdateDraft: CustomizationFieldsProps["onUpdateDraft"];
}

function toLabel(value: string): string {
  return value.replaceAll("-", " ");
}

function FieldCell({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function CustomizationSelectField<TKey extends CustomizationSelectKey>({
  draft,
  field,
  label,
  options,
  onUpdateDraft,
}: CustomizationSelectFieldProps<TKey>) {
  return (
    <SelectField
      label={label}
      options={options.map((value) => ({ label: toLabel(value), value }))}
      value={draft[field]}
      onChange={(value) => onUpdateDraft(field, value)}
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

function QuantityField({
  draft,
  onUpdateDraft,
}: Pick<CustomizationFieldsProps, "draft" | "onUpdateDraft">) {
  return (
    <TextField
      label="Quantity"
      min={1}
      type="number"
      value={draft.quantity}
      onChange={(value: string) =>
        onUpdateDraft("quantity", Math.max(Number.parseInt(value || "1", 10) || 1, 1))
      }
    />
  );
}

function SizeAndMilkFields({ draft, item, onUpdateDraft }: CustomizationFieldsProps) {
  return (
    <FieldRow>
      <FieldCell>
        <CustomizationSelectField
          draft={draft}
          field="size"
          label="Size"
          options={drinkSizes}
          onUpdateDraft={onUpdateDraft}
        />
      </FieldCell>
      <FieldCell>
        <CustomizationSelectField
          draft={draft}
          field="milk"
          label="Milk"
          options={item.availableMilks}
          onUpdateDraft={onUpdateDraft}
        />
      </FieldCell>
    </FieldRow>
  );
}

function TemperatureAndShotsFields({ draft, item, onUpdateDraft }: CustomizationFieldsProps) {
  return (
    <FieldRow>
      <FieldCell>
        <CustomizationSelectField
          draft={draft}
          field="temperature"
          label="Temperature"
          options={item.availableTemperatures}
          onUpdateDraft={onUpdateDraft}
        />
      </FieldCell>
      <FieldCell>
        <ShotsField draft={draft} item={item} onUpdateDraft={onUpdateDraft} />
      </FieldCell>
    </FieldRow>
  );
}

function QuantityFields({
  draft,
  onUpdateDraft,
}: Pick<CustomizationFieldsProps, "draft" | "onUpdateDraft">) {
  return (
    <FieldRow>
      <FieldCell>
        <QuantityField draft={draft} onUpdateDraft={onUpdateDraft} />
      </FieldCell>
    </FieldRow>
  );
}

export function CustomizationFields(inputProps: CustomizationFieldsProps) {
  const { draft, item, onUpdateDraft } = inputProps;

  return (
    <>
      <SizeAndMilkFields draft={draft} item={item} onUpdateDraft={onUpdateDraft} />
      <TemperatureAndShotsFields draft={draft} item={item} onUpdateDraft={onUpdateDraft} />
      <QuantityFields draft={draft} onUpdateDraft={onUpdateDraft} />
    </>
  );
}

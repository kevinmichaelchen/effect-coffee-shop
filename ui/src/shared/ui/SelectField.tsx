import { Label } from "#shared/ui/retroui/Label.tsx";
import { Select } from "#shared/ui/retroui/Select.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";

interface SelectOption<TValue extends string> {
  label: string;
  value: TValue;
}

interface SelectFieldProps<TValue extends string> {
  label: string;
  value: TValue;
  options: readonly SelectOption<TValue>[];
  onChange: (value: TValue) => void;
  disabled?: boolean;
  helperText?: string;
  placeholder?: string;
}

export function SelectField<TValue extends string>(inputProps: SelectFieldProps<TValue>) {
  const { label, value, options, onChange, disabled, helperText, placeholder } = inputProps;
  const selectProps =
    disabled === undefined
      ? { value, onValueChange: onChange }
      : { disabled, value, onValueChange: onChange };

  return (
    <div className="grid gap-2">
      <Label className="font-head text-sm uppercase tracking-[0.08em]">{label}</Label>
      <Select {...selectProps}>
        <Select.Trigger className="w-full">
          <Select.Value placeholder={placeholder} />
        </Select.Trigger>
        <Select.Content>
          {options.map((option) => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
      {helperText !== undefined ? (
        <Text as="p" className="text-sm text-muted-foreground">
          {helperText}
        </Text>
      ) : null}
    </div>
  );
}

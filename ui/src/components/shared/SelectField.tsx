import { Label } from "#components/retroui/Label";
import { Select } from "#components/retroui/Select";
import { Text } from "#components/retroui/Text";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  helperText?: string;
  placeholder?: string;
}

export function SelectField(inputProps: SelectFieldProps) {
  const { label, value, options, onChange, disabled, helperText, placeholder } = inputProps;
  const selectProps = disabled === undefined ? { value, onValueChange: onChange } : { disabled, value, onValueChange: onChange };

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

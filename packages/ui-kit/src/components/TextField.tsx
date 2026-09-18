import { Input } from "#ui/components/retroui/Input.tsx";
import { Label } from "#ui/components/retroui/Label.tsx";
import { Text } from "#ui/components/retroui/Text.tsx";

export interface TextFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  min?: number;
  max?: number;
  disabled?: boolean;
  helperText?: string;
}

export function TextField(inputProps: TextFieldProps) {
  const { label, value, onChange, placeholder, type, min, max, disabled, helperText } = inputProps;

  return (
    <div className="grid gap-2">
      <Label className="font-head text-sm uppercase tracking-[0.08em]">{label}</Label>
      <Input
        disabled={disabled}
        max={max}
        min={min}
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {helperText !== undefined ? (
        <Text as="p" className="text-sm text-muted-foreground">
          {helperText}
        </Text>
      ) : null}
    </div>
  );
}

import type { ChangeEvent } from "react";
import { Label } from "#shared/ui/retroui/Label.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { Textarea } from "#shared/ui/retroui/Textarea.tsx";

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  helperText?: string;
}

export function TextAreaField(inputProps: TextAreaFieldProps) {
  const { label, value, onChange, placeholder, helperText } = inputProps;

  return (
    <div className="grid gap-2">
      <Label className="font-head text-sm uppercase tracking-[0.08em]">{label}</Label>
      <Textarea
        placeholder={placeholder}
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
      />
      {helperText !== undefined ? (
        <Text as="p" className="text-sm text-muted-foreground">
          {helperText}
        </Text>
      ) : null}
    </div>
  );
}

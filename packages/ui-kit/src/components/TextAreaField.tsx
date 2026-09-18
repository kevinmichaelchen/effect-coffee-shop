import { useId } from "react";
import type { ChangeEvent } from "react";
import { Label } from "#ui/components/retroui/Label.tsx";
import { Text } from "#ui/components/retroui/Text.tsx";
import { Textarea } from "#ui/components/retroui/Textarea.tsx";

export interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  helperText?: string;
}

export function TextAreaField(inputProps: TextAreaFieldProps) {
  const { label, value, onChange, placeholder, helperText } = inputProps;

  const fieldId = useId();
  const helperId = `${fieldId}-help`;

  return (
    <div className="grid gap-2">
      <Label htmlFor={fieldId} className="font-head text-sm uppercase tracking-[0.08em]">
        {label}
      </Label>
      <Textarea
        id={fieldId}
        aria-describedby={helperText === undefined ? undefined : helperId}
        placeholder={placeholder}
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
      />
      {helperText !== undefined ? (
        <Text as="p" id={helperId} className="text-sm text-muted-foreground">
          {helperText}
        </Text>
      ) : null}
    </div>
  );
}

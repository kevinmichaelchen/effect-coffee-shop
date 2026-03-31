import type { ChangeEvent, KeyboardEvent } from "react";
import { Button } from "#shared/ui/retroui/Button.tsx";
import { Textarea } from "#shared/ui/retroui/Textarea.tsx";

interface DemoComposerProps {
  helpText?: string;
  input: string;
  isBusy: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  submitLabel?: string;
}

export function DemoComposer(inputProps: DemoComposerProps) {
  const { helpText, input, isBusy, onInputChange, onSubmit, submitLabel } = inputProps;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onInputChange(event.target.value);
  }

  return (
    <div className="grid gap-3 border-t-2 border-border pt-4">
      <Textarea
        className="min-h-32 bg-background"
        placeholder="Ask about the menu, place an order, or triage the queue."
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {helpText ?? "Cmd/Ctrl + Enter sends the prompt."}
        </p>
        <Button disabled={isBusy || input.trim() === ""} onClick={onSubmit}>
          {isBusy ? "Running local loop…" : (submitLabel ?? "Send to local model")}
        </Button>
      </div>
    </div>
  );
}

import type { ChangeEvent, KeyboardEvent } from "react";
import { Button } from "#shared/ui/retroui/Button.tsx";
import { Textarea } from "#shared/ui/retroui/Textarea.tsx";

interface AssistantComposerProps {
  helpText?: string;
  input: string;
  isBusy: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  submitLabel?: string;
}

export function AssistantComposer(inputProps: AssistantComposerProps) {
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
          {helpText ?? "Cmd/Ctrl + Enter sends the prompt to the Cloudflare Worker."}
        </p>
        <Button disabled={isBusy || input.trim() === ""} onClick={onSubmit}>
          {isBusy ? "Calling live tools…" : (submitLabel ?? "Send")}
        </Button>
      </div>
    </div>
  );
}

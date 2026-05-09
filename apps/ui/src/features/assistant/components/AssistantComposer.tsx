import type { ChangeEvent, KeyboardEvent } from "react";
import { Button } from "#shared/ui/retroui/Button.tsx";
import { Spinner } from "#shared/ui/retroui/Spinner.tsx";
import { Textarea } from "#shared/ui/retroui/Textarea.tsx";

interface AssistantComposerProps {
  busyDetail?: string;
  helpText?: string;
  input: string;
  isBusy: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  submitLabel?: string;
}

export function AssistantComposer(inputProps: AssistantComposerProps) {
  const { busyDetail, helpText, input, isBusy, onInputChange, onSubmit, submitLabel } = inputProps;

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
    <div className="grid gap-3 border-t border-border pt-4">
      <Textarea
        className="min-h-32 max-h-56 bg-background"
        placeholder="Ask about the menu, place an order, or triage the queue."
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ComposerStatus busyDetail={busyDetail} helpText={helpText} isBusy={isBusy} />
        <ComposerSubmitButton
          input={input}
          isBusy={isBusy}
          submitLabel={submitLabel}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

interface ComposerStatusProps {
  busyDetail: string | undefined;
  helpText: string | undefined;
  isBusy: boolean;
}

function ComposerStatus(inputProps: ComposerStatusProps) {
  const { busyDetail, helpText, isBusy } = inputProps;

  return (
    <div className="grid gap-2">
      {isBusy ? (
        <div className="flex items-center gap-2 text-sm font-medium">
          <Spinner size="sm" />
          <span>{busyDetail ?? "Waiting on Workers AI…"}</span>
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {helpText ?? "Cmd/Ctrl + Enter sends the prompt to the Cloudflare Worker."}
      </p>
    </div>
  );
}

interface ComposerSubmitButtonProps {
  input: string;
  isBusy: boolean;
  submitLabel: string | undefined;
  onSubmit: () => void;
}

function ComposerSubmitButton(inputProps: ComposerSubmitButtonProps) {
  const { input, isBusy, onSubmit, submitLabel } = inputProps;

  return (
    <Button disabled={isBusy || input.trim() === ""} onClick={onSubmit}>
      {isBusy ? "Calling live tools…" : (submitLabel ?? "Send")}
    </Button>
  );
}

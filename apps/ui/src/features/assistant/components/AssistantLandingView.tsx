import type { ThemePreference } from "#shared/hooks/useThemePreference.ts";
import { appRoutes } from "#app/routes.ts";
import { AssistantTranscript } from "#features/assistant/components/AssistantTranscript.tsx";
import { ToolActivityDrawer } from "#features/assistant/components/ToolActivityDrawer.tsx";
import type {
  AssistantDisplayMessage,
  AssistantStatus,
  AssistantToolActivity,
} from "#features/assistant/lib/assistant-chat.ts";
import type { ConnectionStatus } from "@tanstack/ai-client";
import { ThemeToggle } from "#shared/ui/ThemeToggle.tsx";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";

interface AssistantLandingViewProps {
  connectionStatus: ConnectionStatus;
  errorMessage: string | null;
  events: readonly AssistantToolActivity[];
  input: string;
  isBusy: boolean;
  messages: readonly AssistantDisplayMessage[];
  prompts: readonly string[];
  status: AssistantStatus;
  theme: ThemePreference;
  onInputChange: (value: string) => void;
  onPromptClick: (prompt: string) => void;
  onReset: () => void;
  onSubmit: () => void;
  onToggleTheme: () => void;
}

export function AssistantLandingView(inputProps: AssistantLandingViewProps) {
  const {
    connectionStatus,
    errorMessage,
    events,
    input,
    isBusy,
    messages,
    onInputChange,
    onPromptClick,
    onReset,
    onSubmit,
    onToggleTheme,
    prompts,
    status,
    theme,
  } = inputProps;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 lg:px-6">
      <AssistantShell theme={theme} onToggleTheme={onToggleTheme} />
      <AssistantHeader status={status} />
      <AssistantTranscript
        activityControl={<ToolActivityDrawer events={events} />}
        connectionStatus={connectionStatus}
        errorMessage={errorMessage}
        input={input}
        isBusy={isBusy}
        latestActivity={events.length === 0 ? null : (events[events.length - 1] ?? null)}
        messages={messages}
        prompts={prompts}
        status={status}
        onInputChange={onInputChange}
        onPromptClick={onPromptClick}
        onReset={onReset}
        onSubmit={onSubmit}
      />
    </main>
  );
}

interface AssistantShellProps {
  onToggleTheme: () => void;
  theme: ThemePreference;
}

function AssistantShell({ onToggleTheme, theme }: AssistantShellProps) {
  return (
    <header className="flex min-h-14 items-center justify-between border-b border-border pb-4">
      <Text as="p" className="text-lg font-semibold">
        Beanline
      </Text>
      <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
        <a className="font-medium text-foreground" href={appRoutes.home}>
          Assistant
        </a>
        <a href={appRoutes.shop}>Order</a>
        <a href={appRoutes.staff}>Staff</a>
      </nav>
      <ThemeToggle compact theme={theme} onToggle={onToggleTheme} />
    </header>
  );
}

function AssistantHeader({ status }: Pick<AssistantLandingViewProps, "status">) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-2">
        <Text as="h1" className="text-3xl font-semibold leading-tight md:text-4xl">
          Assistant
        </Text>
        <Text as="p" className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Ask about menu, orders, or queue status.
        </Text>
      </div>
      <Card className="w-full md:w-auto">
        <Card.Content className="flex flex-wrap gap-5 p-4">
          <MetricStrip label="Runtime" value={status.phase === "running" ? "Busy" : "Ready"} />
          <MetricStrip label="Tools" value="Server" />
          <MetricStrip label="State" value="Shared" />
        </Card.Content>
      </Card>
    </section>
  );
}

function MetricStrip({ label, value }: MetricStripProps) {
  return (
    <div className="grid min-w-20 gap-1">
      <Text as="p" className="text-xs text-muted-foreground">
        {label}
      </Text>
      <Text as="p" className="text-xl font-semibold">
        {value}
      </Text>
    </div>
  );
}

interface MetricStripProps {
  label: string;
  value: string;
}

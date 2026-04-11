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
import { Badge } from "#shared/ui/retroui/Badge.tsx";
import { Button } from "#shared/ui/retroui/Button.tsx";
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
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 py-4 lg:px-6">
      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <LandingHero theme={theme} onToggleTheme={onToggleTheme} />
        <LandingFactsCard />
      </section>
      <section className="grid gap-5">
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
      </section>
    </main>
  );
}

interface LandingHeroProps {
  onToggleTheme: () => void;
  theme: ThemePreference;
}

function LandingHero({ onToggleTheme, theme }: LandingHeroProps) {
  return (
    <Card className="w-full border-border bg-primary text-primary-foreground">
      <Card.Content className="grid gap-5 p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-none bg-black px-2.5 py-1 text-white" size="sm">
              Cloudflare Workers AI
            </Badge>
            <Badge className="rounded-none px-2.5 py-1" size="sm" variant="outline">
              D1-backed coffee tools
            </Badge>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <div className="grid gap-3">
          <Text as="h1" className="max-w-4xl text-4xl leading-none md:text-6xl">
            Beanline Control Surface
          </Text>
          <Text as="p" className="max-w-3xl text-base text-primary-foreground/80 md:text-lg">
            The landing assistant now runs through your same-origin Cloudflare Worker, executes
            coffee tools server-side, and shares the same live state as the control room.
          </Text>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <a href={appRoutes.controlRoom}>Open control room</a>
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

function LandingFactsCard() {
  return (
    <Card className="w-full border-border bg-card">
      <Card.Content className="grid gap-4 p-5">
        <MetricStrip label="Assistant runtime" value="Workers AI via same-origin Worker" />
        <MetricStrip label="Tool orchestration" value="TanStack AI server tools + SSE stream" />
        <MetricStrip label="Coffee state" value="Shared D1 database for orders and queue" />
        <MetricStrip label="Deployment shape" value="Static UI + Worker + D1 on Cloudflare" />
      </Card.Content>
    </Card>
  );
}

interface MetricStripProps {
  label: string;
  value: string;
}

function MetricStrip({ label, value }: MetricStripProps) {
  return (
    <div className="grid gap-2 border-b-2 border-dashed border-border pb-3 last:border-b-0 last:pb-0">
      <Text as="p" className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </Text>
      <Text as="h3" className="text-xl leading-snug">
        {value}
      </Text>
    </div>
  );
}

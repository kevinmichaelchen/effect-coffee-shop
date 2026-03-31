import { Badge } from "#components/retroui/Badge";
import { Button } from "#components/retroui/Button";
import { Card } from "#components/retroui/Card";
import { Text } from "#components/retroui/Text";
import { DemoTranscript } from "#components/landing/DemoTranscript";
import { ToolActivityDrawer } from "#components/landing/ToolActivityDrawer";
import { ThemeToggle } from "#components/shared/ThemeToggle";
import { type AssistantEvent } from "#lib/assistant-loop";
import { type DemoCacheStatus, type DemoMessage, type DemoStatus } from "#hooks/lfmAssistantSupport";
import { useLfmCoffeeAssistant } from "#hooks/useLfmCoffeeAssistant";
import { useThemePreference } from "#hooks/useThemePreference";
import { appRoutes } from "#lib/routes";

export function BrowserMcpLandingPage() {
  const assistant = useLfmCoffeeAssistant();
  const { theme, toggleTheme } = useThemePreference();

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 py-4 lg:px-6">
      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <LandingHero theme={theme} onToggleTheme={toggleTheme} onWarmUp={() => void assistant.warmUp()} />
        <LandingFactsCard />
      </section>
      <LandingPanels
        assistantDraft={assistant.assistantDraft}
        cacheStatus={assistant.cacheStatus}
        errorMessage={assistant.errorMessage}
        events={assistant.events}
        hasLoadedModel={assistant.hasLoadedModel}
        input={assistant.input}
        isBusy={assistant.isBusy}
        messages={assistant.messages}
        prompts={assistant.prompts}
        status={assistant.status}
        onInputChange={assistant.setInput}
        onPromptClick={(prompt) => void assistant.submit(prompt)}
        onReset={assistant.resetConversation}
        onSubmit={() => void assistant.submit()}
        onWarmUp={() => void assistant.warmUp()}
      />
    </main>
  );
}

interface LandingHeroProps {
  onToggleTheme: () => void;
  onWarmUp: () => void;
  theme: ReturnType<typeof useThemePreference>["theme"];
}

function LandingHero({ onToggleTheme, onWarmUp, theme }: LandingHeroProps) {
  return (
    <Card className="w-full border-border bg-primary text-primary-foreground">
      <Card.Content className="grid gap-5 p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-none bg-black px-2.5 py-1 text-white" size="sm">
              LiquidAI + WebGPU
            </Badge>
            <Badge className="rounded-none px-2.5 py-1" size="sm" variant="outline">
              MCP-native coffee actions
            </Badge>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <div className="grid gap-3">
          <Text as="h1" className="max-w-4xl text-4xl leading-none md:text-6xl">
            Browser Barista Brain
          </Text>
          <Text as="p" className="max-w-3xl text-base text-primary-foreground/80 md:text-lg">
            Load LiquidAI&apos;s LFM2.5-350M in the browser, let it decide when to call your Coffee
            Shop MCP server, and keep the original customer-plus-barista control room one click away.
          </Text>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={onWarmUp}>Preload browser model</Button>
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
        <MetricStrip label="Browser runtime" value="LiquidAI/LFM2.5-350M-ONNX q4" />
        <MetricStrip label="Inference stack" value="onnxruntime-web + Transformers.js" />
        <MetricStrip label="Tool transport" value="POST /mcp on the Onion backend" />
        <MetricStrip label="Why this route" value="Local inference, live coffee actions" />
      </Card.Content>
    </Card>
  );
}

interface LandingPanelsProps {
  assistantDraft: string;
  cacheStatus: DemoCacheStatus;
  errorMessage: string | null;
  events: readonly AssistantEvent[];
  hasLoadedModel: boolean;
  input: string;
  isBusy: boolean;
  messages: readonly DemoMessage[];
  prompts: readonly string[];
  status: DemoStatus;
  onInputChange: (value: string) => void;
  onPromptClick: (prompt: string) => void;
  onReset: () => void;
  onSubmit: () => void;
  onWarmUp: () => void;
}

function LandingPanels(inputProps: LandingPanelsProps) {
  const { assistantDraft, cacheStatus, errorMessage, events, hasLoadedModel, input, isBusy, messages, onInputChange, onPromptClick, onReset, onSubmit, onWarmUp, prompts, status } = inputProps;

  return (
    <section className="grid gap-5">
      <DemoTranscript
        activityControl={<ToolActivityDrawer events={events} />}
        assistantDraft={assistantDraft}
        cacheStatus={cacheStatus}
        errorMessage={errorMessage}
        hasLoadedModel={hasLoadedModel}
        input={input}
        isBusy={isBusy}
        messages={messages}
        prompts={prompts}
        status={status}
        onInputChange={onInputChange}
        onPromptClick={onPromptClick}
        onReset={onReset}
        onSubmit={onSubmit}
        onWarmUp={onWarmUp}
      />
    </section>
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

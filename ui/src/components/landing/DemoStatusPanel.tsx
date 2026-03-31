import { Badge } from "#components/retroui/Badge";
import { Progress } from "#components/retroui/Progress";
import { Spinner } from "#components/retroui/Spinner";
import { Text } from "#components/retroui/Text";
import type { DemoCacheStatus, DemoStatus } from "#hooks/lfmAssistantSupport";

interface DemoStatusPanelProps {
  cacheStatus: DemoCacheStatus;
  hasLoadedModel: boolean;
  isBusy: boolean;
  status: DemoStatus;
}

export function DemoStatusPanel({ cacheStatus, hasLoadedModel, isBusy, status }: DemoStatusPanelProps) {
  const detail = hasLoadedModel
    ? "LFM2.5-350M is loaded in this tab and ready to use Coffee Shop MCP tools."
    : cacheStatus.label;

  return (
    <div className="grid gap-3 border-2 border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            {isBusy ? <Spinner size="sm" /> : null}
            <Text as="p" className="text-sm font-semibold uppercase tracking-[0.08em]">
              {status.label}
            </Text>
          </div>
          <Text as="p" className="max-w-2xl text-sm text-muted-foreground">
            {detail}
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasLoadedModel ? <LoadedBadge /> : <CacheBadge phase={cacheStatus.phase} />}
          <RuntimeBadge phase={status.phase} />
        </div>
      </div>
      {status.phase === "loading" ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-sm uppercase tracking-[0.08em]">
            <span>download</span>
            <span>{status.progress}%</span>
          </div>
          <Progress value={status.progress} />
        </div>
      ) : null}
    </div>
  );
}

function LoadedBadge() {
  return (
    <Badge className="rounded-none px-2.5 py-1" size="sm" variant="surface">
      Loaded in tab
    </Badge>
  );
}

interface CacheBadgeProps {
  phase: DemoCacheStatus["phase"];
}

function CacheBadge({ phase }: CacheBadgeProps) {
  return (
    <Badge className="rounded-none px-2.5 py-1" size="sm" variant={cachePhaseToVariant[phase]}>
      {cachePhaseLabel[phase]}
    </Badge>
  );
}

interface RuntimeBadgeProps {
  phase: DemoStatus["phase"];
}

function RuntimeBadge({ phase }: RuntimeBadgeProps) {
  return (
    <Badge className="rounded-none px-2.5 py-1" size="sm" variant={runtimePhaseToVariant[phase]}>
      {runtimePhaseLabel[phase]}
    </Badge>
  );
}

const cachePhaseLabel = {
  checking: "Checking cache",
  cold: "Download required",
  partial: "Some assets cached",
  unsupported: "Cache unknown",
  warm: "Likely cached",
} as const;

const runtimePhaseLabel = {
  error: "Error",
  idle: "Idle",
  loading: "Loading",
  ready: "Ready",
  running: "Running",
} as const;

const cachePhaseToVariant = {
  checking: "outline",
  cold: "solid",
  partial: "surface",
  unsupported: "outline",
  warm: "surface",
} as const;

const runtimePhaseToVariant = {
  error: "solid",
  idle: "outline",
  loading: "surface",
  ready: "surface",
  running: "solid",
} as const;

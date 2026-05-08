import { Card } from "#shared/ui/retroui/Card.tsx";
import { Progress } from "#shared/ui/retroui/Progress.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";

export interface WorkspaceMetric {
  label: string;
  progress?: number;
  value: string;
}

export function WorkspaceMetricStrip({ metrics }: { metrics: readonly WorkspaceMetric[] }) {
  return (
    <Card>
      <Card.Content className="flex flex-wrap gap-5 p-4">
        {metrics.map((metric) => (
          <Metric key={metric.label} {...metric} />
        ))}
      </Card.Content>
    </Card>
  );
}

function Metric({ label, progress, value }: WorkspaceMetric) {
  return (
    <div className="grid min-w-20 gap-1">
      <Text as="p" className="text-xs text-muted-foreground">
        {label}
      </Text>
      <Text as="p" className="text-2xl font-semibold">
        {value}
      </Text>
      {progress !== undefined ? <Progress className="h-1.5" value={progress} /> : null}
    </div>
  );
}

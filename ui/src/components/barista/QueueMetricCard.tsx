import { Card } from "#components/retroui/Card";
import { Progress } from "#components/retroui/Progress";
import { Text } from "#components/retroui/Text";

interface QueueMetricCardProps {
  label: string;
  value: string;
  progress?: number;
}

export function QueueMetricCard({ label, value, progress }: QueueMetricCardProps) {
  return (
    <Card className="w-full border-border">
      <Card.Content className="grid gap-3 p-4">
        <Text as="p" className="text-sm uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </Text>
        <Text as="h2" className="text-4xl">
          {value}
        </Text>
        {progress !== undefined ? <Progress value={progress} /> : null}
      </Card.Content>
    </Card>
  );
}

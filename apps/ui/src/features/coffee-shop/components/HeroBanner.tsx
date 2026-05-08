import { Badge } from "#shared/ui/retroui/Badge.tsx";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { Progress } from "#shared/ui/retroui/Progress.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
interface HeroBannerProps {
  badgeLabel: string;
  description: string;
  isRefreshingText: string;
  queueLoad: number;
  title: string;
  metrics: readonly MetricLineProps[];
}

export function HeroBanner(inputProps: HeroBannerProps) {
  const { badgeLabel, description, isRefreshingText, metrics, queueLoad, title } = inputProps;

  return (
    <Card className="w-full border-border bg-primary text-primary-foreground">
      <Card.Content className="grid gap-6 p-5 lg:grid-cols-[1.2fr_0.8fr] lg:p-6">
        <div className="grid gap-3">
          <Badge className="w-fit rounded-none bg-black px-2.5 py-1 text-white" size="sm">
            {badgeLabel}
          </Badge>
          <Text as="h2" className="max-w-2xl text-3xl leading-none md:text-5xl">
            {title}
          </Text>
          <Text as="p" className="max-w-2xl text-base text-primary-foreground/80 md:text-lg">
            {description}
          </Text>
        </div>
        <div className="grid gap-4 border-2 border-black bg-card p-4 text-card-foreground shadow-md">
          {metrics.map((metric) => (
            <MetricLine key={metric.label} label={metric.label} value={metric.value} />
          ))}
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-sm font-medium uppercase tracking-[0.08em]">
              <span>Queue load</span>
              <span>{queueLoad}%</span>
            </div>
            <Progress value={queueLoad} />
          </div>
          <Text as="p" className="text-sm text-muted-foreground">
            {isRefreshingText}
          </Text>
        </div>
      </Card.Content>
    </Card>
  );
}

interface MetricLineProps {
  label: string;
  value: string;
}

function MetricLine({ label, value }: MetricLineProps) {
  return (
    <div className="flex items-end justify-between gap-3 border-b-2 border-dashed border-border pb-2">
      <Text as="p" className="text-sm uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </Text>
      <Text as="h3" className="text-2xl">
        {value}
      </Text>
    </div>
  );
}

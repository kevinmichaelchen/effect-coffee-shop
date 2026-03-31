import { Badge } from "#shared/ui/retroui/Badge.tsx";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { Progress } from "#shared/ui/retroui/Progress.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { formatPrice } from "#features/coffee-shop/lib/coffee.ts";

interface HeroBannerProps {
  activeOrders: number;
  isRefreshing: boolean;
  menuCount: number;
  queueLoad: number;
}

export function HeroBanner(inputProps: HeroBannerProps) {
  const { activeOrders, isRefreshing, menuCount, queueLoad } = inputProps;

  return (
    <Card className="w-full border-border bg-primary text-primary-foreground">
      <Card.Content className="grid gap-6 p-5 lg:grid-cols-[1.2fr_0.8fr] lg:p-6">
        <div className="grid gap-3">
          <Badge className="w-fit rounded-none bg-black px-2.5 py-1 text-white" size="sm">
            RetroUI + React Query
          </Badge>
          <Text as="h2" className="max-w-2xl text-3xl leading-none md:text-5xl">
            Fast ordering on the left. Live queue pressure on the right.
          </Text>
          <Text as="p" className="max-w-2xl text-base text-primary-foreground/80 md:text-lg">
            The menu is loaded from the existing backend, tickets flow through the existing status
            endpoints, and the UI stays intentionally loud without adding backend sprawl.
          </Text>
        </div>
        <div className="grid gap-4 border-2 border-black bg-card p-4 text-card-foreground shadow-md">
          <MetricLine label="Menu items" value={String(menuCount)} />
          <MetricLine label="Average latte" value={formatPrice(593)} />
          <MetricLine label="Active queue" value={String(activeOrders)} />
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-sm font-medium uppercase tracking-[0.08em]">
              <span>Queue load</span>
              <span>{queueLoad}%</span>
            </div>
            <Progress value={queueLoad} />
          </div>
          <Text as="p" className="text-sm text-muted-foreground">
            {isRefreshing ? "Refreshing order board…" : "Board synced with the HTTP API."}
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

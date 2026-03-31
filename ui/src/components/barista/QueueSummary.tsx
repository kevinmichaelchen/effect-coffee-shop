import { QueueMetricCard } from "#components/barista/QueueMetricCard";

interface QueueSummaryProps {
  activeCount: number;
  historyCount: number;
  queueLoad: number;
  readyCount: number;
}

export function QueueSummary(inputProps: QueueSummaryProps) {
  const { activeCount, historyCount, queueLoad, readyCount } = inputProps;

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <QueueMetricCard label="Active tickets" value={String(activeCount)} progress={queueLoad} />
      <QueueMetricCard label="Ready to call" value={String(readyCount)} />
      <QueueMetricCard label="Closed tickets" value={String(historyCount)} />
    </section>
  );
}

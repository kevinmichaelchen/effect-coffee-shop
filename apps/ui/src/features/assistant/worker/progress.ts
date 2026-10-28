/** Sums per-file download progress into one figure, so the UI shows one bar per model. */
export const aggregateProgress = (report: (loaded: number, total: number) => void) => {
  const files = new Map<string, { readonly loaded: number; readonly total: number }>();
  return (file: string, loaded: number, total: number) => {
    files.set(file, { loaded, total });
    const sum = Array.from(files.values()).reduce(
      (totals, entry) => ({
        loaded: totals.loaded + entry.loaded,
        total: totals.total + entry.total,
      }),
      { loaded: 0, total: 0 },
    );
    report(sum.loaded, sum.total);
  };
};

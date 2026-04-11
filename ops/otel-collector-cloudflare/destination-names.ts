const sanitizeStage = (value: string): string =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const currentStage = (): string =>
  sanitizeStage(process.env.ALCHEMY_STAGE ?? "default") || "default";

const destinationBaseName = (): string =>
  `effect-v4-onion-otel-${currentStage()}`;

export const collectorTraceDestinationName = (): string =>
  `${destinationBaseName()}-traces`;

export const collectorLogDestinationName = (): string =>
  `${destinationBaseName()}-logs`;

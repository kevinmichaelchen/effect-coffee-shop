export const viewModes = ["dual", "customer", "barista"] as const;

export type ViewMode = (typeof viewModes)[number];

export const drinkSizes = ["small", "medium", "large"] as const;
export const milks = ["whole", "oat", "almond", "none"] as const;
export const temperatures = ["hot", "iced", "extra-hot"] as const;
export const orderStatuses = [
  "pending",
  "brewing",
  "ready",
  "picked-up",
  "cancelled",
] as const;

export type DrinkSize = (typeof drinkSizes)[number];
export type Milk = (typeof milks)[number];
export type Temperature = (typeof temperatures)[number];
export type OrderStatus = (typeof orderStatuses)[number];
export type OrderAction = "start-brewing" | "mark-ready" | "pick-up" | "cancel";

export interface MenuItem {
  id: string;
  name: string;
  kind: "espresso" | "tea";
  basePriceCents: number;
  availableMilks: Milk[];
  availableTemperatures: Temperature[];
  maxShots: number;
}

export interface CoffeeOrder {
  id: string;
  customerName: string;
  drinkId: string;
  drinkName: string;
  size: DrinkSize;
  milk: Milk;
  temperature: Temperature;
  shots: number;
  notes?: string;
  status: OrderStatus;
  priceCents: number;
  createdAt: string;
}

export interface PlaceOrderRequest {
  customerName: string;
  drinkId: string;
  size: DrinkSize;
  milk?: Milk;
  temperature?: Temperature;
  shots?: number;
  notes?: string;
}

export interface OrderDraft {
  customerName: string;
  drinkId: string;
  size: DrinkSize;
  milk: Milk;
  temperature: Temperature;
  shots: number;
  notes: string;
}

export interface CoffeeApiError {
  _tag?: string;
  message?: string;
}

export interface OrderActionOption {
  action: OrderAction;
  label: string;
}

const activeStatuses = new Set<OrderStatus>(["pending", "brewing", "ready"]);
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const sizeMultipliers: Record<DrinkSize, number> = {
  small: 1,
  medium: 1.15,
  large: 1.3,
};

const statusLabels: Record<OrderStatus, string> = {
  pending: "Pending",
  brewing: "Brewing",
  ready: "Ready",
  "picked-up": "Picked Up",
  cancelled: "Cancelled",
};

const statusProgress: Record<OrderStatus, number> = {
  pending: 20,
  brewing: 55,
  ready: 100,
  "picked-up": 100,
  cancelled: 100,
};

const actionOptions: Record<OrderStatus, readonly OrderActionOption[]> = {
  pending: [
    { action: "start-brewing", label: "Start" },
    { action: "cancel", label: "Cancel" },
  ],
  brewing: [
    { action: "mark-ready", label: "Mark Ready" },
    { action: "cancel", label: "Cancel" },
  ],
  ready: [{ action: "pick-up", label: "Picked Up" }],
  "picked-up": [],
  cancelled: [],
};

export function defaultMilkFor(item: MenuItem): Milk {
  return item.availableMilks.includes("whole") ? "whole" : (item.availableMilks[0] ?? "none");
}

export function defaultTemperatureFor(item: MenuItem): Temperature {
  return item.availableTemperatures[0] ?? "hot";
}

export function defaultShotsFor(item: MenuItem): number {
  return item.kind === "tea" ? 0 : 1;
}

export function calculatePriceCents(item: MenuItem, size: DrinkSize, shots: number): number {
  const base = Math.round(item.basePriceCents * sizeMultipliers[size]);
  const extraShots = Math.max(shots - defaultShotsFor(item), 0);
  return base + extraShots * 75;
}

export function formatPrice(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function formatOrderTime(createdAt: string): string {
  return timeFormatter.format(new Date(createdAt));
}

export function getStatusLabel(status: OrderStatus): string {
  return statusLabels[status];
}

export function getStatusProgress(status: OrderStatus): number {
  return statusProgress[status];
}

export function getOrderActions(status: OrderStatus): readonly OrderActionOption[] {
  return actionOptions[status];
}

export function isActiveOrder(order: CoffeeOrder): boolean {
  return activeStatuses.has(order.status);
}

export function createOrderDraft(item: MenuItem): OrderDraft {
  return {
    customerName: "",
    drinkId: item.id,
    size: "medium",
    milk: defaultMilkFor(item),
    temperature: defaultTemperatureFor(item),
    shots: defaultShotsFor(item),
    notes: "",
  };
}

export function normalizeDraftForItem(draft: OrderDraft, item: MenuItem): OrderDraft {
  const milk = item.availableMilks.includes(draft.milk) ? draft.milk : defaultMilkFor(item);
  const temperature = item.availableTemperatures.includes(draft.temperature)
    ? draft.temperature
    : defaultTemperatureFor(item);
  const shots = Math.min(Math.max(draft.shots, 0), item.maxShots);

  return {
    ...draft,
    drinkId: item.id,
    milk,
    temperature,
    shots: item.kind === "tea" ? 0 : shots,
  };
}

export function toPlaceOrderRequest(draft: OrderDraft): PlaceOrderRequest {
  return {
    customerName: draft.customerName,
    drinkId: draft.drinkId,
    size: draft.size,
    milk: draft.milk,
    temperature: draft.temperature,
    shots: draft.shots,
    notes: draft.notes,
  };
}

export function getQueueLoad(activeOrders: number, targetCapacity = 8): number {
  return Math.min(100, Math.round((activeOrders / targetCapacity) * 100));
}

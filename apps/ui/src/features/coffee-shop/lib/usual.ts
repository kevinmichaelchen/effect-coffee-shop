import { Array as Arr, Option } from "effect";
import { normalizeDraftForItem } from "./coffee.ts";
import type { MenuItem, OrderDraft, OrderTicket } from "./coffee-schemas.ts";

type OrderItem = OrderTicket["items"][number];

/** What makes two tickets the same habit: the drink and how it was asked for. */
type DrinkKey = Pick<OrderItem, "drinkId" | "size" | "milk" | "temperature" | "shots">;

interface Tally {
  readonly drink: DrinkKey;
  readonly count: number;
  readonly latestCreatedAt: string;
}

/** A drink has to show up at least this many times to count as a usual. */
const minimumCount = 2;

const fieldSeparator = "\u0000";

const keyOf = (drink: DrinkKey): string =>
  [drink.drinkId, drink.size, drink.milk, drink.temperature, String(drink.shots)].join(
    fieldSeparator,
  );

const drinkOf = (item: OrderItem): DrinkKey => ({
  drinkId: item.drinkId,
  size: item.size,
  milk: item.milk,
  temperature: item.temperature,
  shots: item.shots,
});

const laterOf = (previous: Tally | undefined, createdAt: string): string =>
  previous === undefined || createdAt > previous.latestCreatedAt
    ? createdAt
    : previous.latestCreatedAt;

const addOrder = (tallies: Map<string, Tally>, order: OrderTicket): Map<string, Tally> =>
  order.items.reduce((next, item) => {
    const drink = drinkOf(item);
    const key = keyOf(drink);
    const previous = next.get(key);
    next.set(key, {
      drink,
      count: (previous?.count ?? 0) + item.quantity,
      latestCreatedAt: laterOf(previous, order.createdAt),
    });
    return next;
  }, tallies);

const isMoreUsual = (candidate: Tally, incumbent: Tally): boolean =>
  candidate.count > incumbent.count ||
  (candidate.count === incumbent.count && candidate.latestCreatedAt > incumbent.latestCreatedAt);

const draftFor = (tally: Tally, item: MenuItem): OrderDraft =>
  normalizeDraftForItem({ ...tally.drink, quantity: 1, notes: "" }, item);

/** The drink a customer orders most, as a draft: a frequency table over their past tickets. */
export function usualDraft(
  orders: readonly OrderTicket[],
  menu: readonly MenuItem[],
): Option.Option<OrderDraft> {
  const tallies = Arr.reduce(
    Arr.filter(orders, (order) => order.status !== "cancelled"),
    new Map<string, Tally>(),
    addOrder,
  );

  const favourite = Arr.reduce(
    Arr.filter(Arr.fromIterable(tallies.values()), (tally) => tally.count >= minimumCount),
    Option.none<Tally>(),
    (best, tally) =>
      Option.some(
        Option.match(best, {
          onNone: () => tally,
          onSome: (incumbent) => (isMoreUsual(tally, incumbent) ? tally : incumbent),
        }),
      ),
  );

  return Option.flatMap(favourite, (tally) =>
    Option.map(
      Arr.findFirst(menu, (item) => item.id === tally.drink.drinkId),
      (item) => draftFor(tally, item),
    ),
  );
}

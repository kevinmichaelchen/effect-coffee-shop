import { Option } from "effect";
import {
  calculatePriceCents,
  createOrderDraft,
  normalizeDraftForItem,
} from "#features/coffee-shop/lib/coffee.ts";
import type { MenuItem, OrderDraft } from "#features/coffee-shop/lib/coffee.ts";

export interface Composer {
  readonly draft: OrderDraft;
  readonly item: MenuItem;
  readonly priceCents: number;
}

/**
 * The draft the composer shows. Falls back to the first menu item while the
 * customer has not chosen yet, and keeps every field valid for the item.
 */
export function composerFor(
  menu: readonly MenuItem[],
  rawDraft: Option.Option<OrderDraft>,
): Option.Option<Composer> {
  const fallback = Option.fromNullishOr(menu[0]);
  const chosen = rawDraft.pipe(
    Option.flatMap((draft) => Option.fromNullishOr(menu.find((item) => item.id === draft.drinkId))),
  );
  return Option.orElse(chosen, () => fallback).pipe(
    Option.map((item) => {
      const draft = normalizeDraftForItem(
        Option.getOrElse(rawDraft, () => createOrderDraft(item)),
        item,
      );
      return {
        draft,
        item,
        priceCents: calculatePriceCents(item, draft.size, draft.shots) * draft.quantity,
      };
    }),
  );
}

/** Chooses another drink, carrying over what still applies to it. */
export function selectDrink(
  menu: readonly MenuItem[],
  rawDraft: Option.Option<OrderDraft>,
  drinkId: string,
): Option.Option<OrderDraft> {
  return Option.fromNullishOr(menu.find((item) => item.id === drinkId)).pipe(
    Option.map((item) =>
      normalizeDraftForItem(
        Option.getOrElse(rawDraft, () => createOrderDraft(item)),
        item,
      ),
    ),
  );
}

export const toInt = (value: string, fallback: number): number =>
  Number.parseInt(value === "" ? String(fallback) : value, 10) || fallback;

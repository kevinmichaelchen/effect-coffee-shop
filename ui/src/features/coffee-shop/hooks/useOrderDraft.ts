import { useMemo, useState } from "react";
import { createOrderDraft, normalizeDraftForItem, calculatePriceCents } from "#features/coffee-shop/lib/coffee.ts";
import type { MenuItem, OrderDraft } from "#features/coffee-shop/lib/coffee.ts";

function findItem(menu: readonly MenuItem[], drinkId: string): MenuItem | undefined {
  return menu.find((item) => item.id === drinkId);
}

export function useOrderDraft(menu: readonly MenuItem[]) {
  const [rawDraft, setDraft] = useState<OrderDraft | null>(null);
  const selectedItem = useMemo(() => {
    const fallbackItem = menu[0];

    if (fallbackItem === undefined) {
      return undefined;
    }

    return findItem(menu, rawDraft?.drinkId ?? fallbackItem.id) ?? fallbackItem;
  }, [menu, rawDraft?.drinkId]);

  const draft = useMemo(() => {
    if (selectedItem === undefined) {
      return null;
    }

    return normalizeDraftForItem(rawDraft ?? createOrderDraft(selectedItem), selectedItem);
  }, [rawDraft, selectedItem]);

  const priceCents = useMemo(() => {
    if (draft === null || selectedItem === undefined) {
      return 0;
    }

    return calculatePriceCents(selectedItem, draft.size, draft.shots);
  }, [draft, selectedItem]);

  function selectDrink(drinkId: string): void {
    const item = findItem(menu, drinkId);

    if (item === undefined) {
      return;
    }

    setDraft((currentDraft) => normalizeDraftForItem(currentDraft ?? createOrderDraft(item), item));
  }

  function updateDraft<K extends keyof OrderDraft>(key: K, value: OrderDraft[K]): void {
    setDraft((currentDraft) => (currentDraft === null ? currentDraft : { ...currentDraft, [key]: value }));
  }

  function resetDraft(): void {
    if (selectedItem !== undefined) {
      setDraft(createOrderDraft(selectedItem));
    }
  }

  return { draft, priceCents, selectedItem, selectDrink, updateDraft, resetDraft };
}

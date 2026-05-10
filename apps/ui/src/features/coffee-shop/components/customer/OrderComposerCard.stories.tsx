import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { OrderComposerCard } from "#features/coffee-shop/components/customer/OrderComposerCard.tsx";
import {
  storyDraft,
  storyMenu,
  storySelectedItem,
} from "#features/coffee-shop/components/coffeeShopStoryData.ts";
import {
  calculatePriceCents,
  normalizeDraftForItem,
  type MenuItem,
  type OrderDraft,
} from "#features/coffee-shop/lib/coffee.ts";

interface OrderComposerStoryProps {
  pending?: boolean;
}

function createNextDraft(
  menu: readonly [MenuItem, ...MenuItem[]],
  currentDraft: OrderDraft,
  drinkId: string,
): { draft: OrderDraft; item: MenuItem } {
  const item = menu.find((entry) => entry.id === drinkId) ?? menu[0];
  return {
    draft: normalizeDraftForItem(currentDraft, item),
    item,
  };
}

function OrderComposerStory({ pending = false }: OrderComposerStoryProps) {
  const [item, setItem] = useState(storySelectedItem);
  const [draft, setDraft] = useState(storyDraft);

  function handleSelectDrink(drinkId: string) {
    const next = createNextDraft(storyMenu, draft, drinkId);
    setDraft(next.draft);
    setItem(next.item);
  }

  function handleUpdateDraft<K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  return (
    <OrderComposerCard
      draft={draft}
      item={item}
      menu={storyMenu}
      pending={pending}
      priceCents={calculatePriceCents(item, draft.size, draft.shots) * draft.quantity}
      onSelectDrink={handleSelectDrink}
      onSubmit={fn()}
      onUpdateDraft={handleUpdateDraft}
    />
  );
}

const meta = {
  title: "Coffee Shop/Customer/OrderComposerCard",
  component: OrderComposerStory,
  tags: ["autodocs"],
} satisfies Meta<typeof OrderComposerStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Pending: Story = {
  args: {
    pending: true,
  },
};

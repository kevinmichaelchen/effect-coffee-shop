import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
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
  initialDraft?: OrderDraft;
  onSubmit: () => void;
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

function OrderComposerStory({
  pending = false,
  initialDraft = storyDraft,
  onSubmit,
}: OrderComposerStoryProps) {
  const [item, setItem] = useState(storySelectedItem);
  const [draft, setDraft] = useState(initialDraft);

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
      onSubmit={onSubmit}
      onUpdateDraft={handleUpdateDraft}
    />
  );
}

const meta = {
  title: "Coffee Shop/Customer/OrderComposerCard",
  component: OrderComposerStory,
  tags: ["autodocs"],
  args: { onSubmit: fn() },
  parameters: {
    docs: {
      description: {
        component:
          "Interactive order builder using the real menu constraints and price calculation. Switch drinks, customize, and submit without a backend.",
      },
    },
  },
} satisfies Meta<typeof OrderComposerStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Pending: Story = {
  args: {
    pending: true,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const submit = canvas.getByRole("button", { name: "Sending order…" });
    await expect(submit).toBeDisabled();
    await userEvent.click(submit);
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const SubmitOrder: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.clear(canvas.getByRole("textbox", { name: "Notes" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Notes" }), "No lid, please.");
    await userEvent.click(canvas.getByRole("button", { name: "Send to queue" }));
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole("textbox", { name: "Notes" })).toHaveValue("No lid, please.");
  },
};

export const TeaConstraints: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Earl Grey" }));
    await expect(canvas.getByRole("spinbutton", { name: "Shots" })).toBeDisabled();
    await expect(canvas.getByRole("spinbutton", { name: "Shots" })).toHaveValue(0);
    await expect(canvas.getByRole("combobox", { name: "Milk" })).toHaveTextContent("none");
    await expect(canvas.getByRole("heading", { name: "$3.97" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Latte" }));
    await expect(canvas.getByRole("spinbutton", { name: "Shots" })).toBeEnabled();
  },
};

export const QuantityUpdatesTotal: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "$6.79" })).toBeInTheDocument();
    await userEvent.type(canvas.getByRole("spinbutton", { name: "Quantity" }), "2");
    await expect(canvas.getByRole("spinbutton", { name: "Quantity" })).toHaveValue(12);
    await expect(canvas.getByRole("heading", { name: "$81.48" })).toBeInTheDocument();
  },
};

export const LongNote: Story = {
  args: {
    initialDraft: {
      ...storyDraft,
      notes:
        "Please label each cup for our study group. We will collect the drinks together at the counter; no lids needed. Thank you!",
      quantity: 4,
    },
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const Tablet: Story = {
  globals: { viewport: { value: "tablet", isRotated: false } },
};

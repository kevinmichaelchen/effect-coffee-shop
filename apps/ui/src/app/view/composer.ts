import { Option } from "effect";
import { alert } from "@effect-coffee-shop/ui-kit/components/alert";
import { button } from "@effect-coffee-shop/ui-kit/components/button";
import { card, cardContent, cardTitleHeader } from "@effect-coffee-shop/ui-kit/components/card";
import { selectField, textAreaField, textField } from "@effect-coffee-shop/ui-kit/components/field";
import { drinkSizes } from "#features/coffee-shop/lib/coffee.ts";
import { usualDraft } from "#features/coffee-shop/lib/usual.ts";
import { orderPreview } from "#app/view/preview.ts";
import { composerFor, type Composer } from "#app/draft.ts";
import { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";
import type { Builder } from "#app/view/builder.ts";

const toLabel = (value: string): string => value.replaceAll("-", " ");
const options = (values: readonly string[]) =>
  values.map((value) => ({ label: toLabel(value), value }));

function drinkPicker(model: Model, composer: Composer, h: Builder) {
  return h.div(
    [h.Class("flex flex-wrap gap-2")],
    model.menu.map((item) =>
      button(
        {
          attributes: [h.OnClick(Message.ClickedSelectDrink({ drinkId: item.id }))],
          size: "sm",
          variant: item.id === composer.draft.drinkId ? "secondary" : "outline",
        },
        [item.name],
        h,
      ),
    ),
  );
}

const fieldRow = (cells: readonly ReturnType<typeof selectField>[], h: Builder) =>
  h.div(
    [h.Class("grid gap-4 md:grid-cols-2")],
    cells.map((cell) => h.div([h.Class("min-w-0")], [cell])),
  );

function sizeAndMilk(composer: Composer, h: Builder) {
  const { draft, item } = composer;
  return fieldRow(
    [
      selectField(
        {
          id: "order-size",
          label: "Size",
          value: draft.size,
          options: options(drinkSizes),
          onChange: (value) => Message.ChangedDrinkSize({ value }),
        },
        h,
      ),
      selectField(
        {
          id: "order-milk",
          label: "Milk",
          value: draft.milk,
          options: options(item.availableMilks),
          onChange: (value) => Message.ChangedMilk({ value }),
        },
        h,
      ),
    ],
    h,
  );
}

function temperatureAndShots(composer: Composer, h: Builder) {
  const { draft, item } = composer;
  return fieldRow(
    [
      selectField(
        {
          id: "order-temperature",
          label: "Temperature",
          value: draft.temperature,
          options: options(item.availableTemperatures),
          onChange: (value) => Message.ChangedTemperature({ value }),
        },
        h,
      ),
      textField(
        {
          id: "order-shots",
          label: "Shots",
          type: "number",
          min: 0,
          max: item.maxShots,
          value: String(draft.shots),
          disabled: item.kind === "tea",
          helperText:
            item.kind === "tea" ? "Tea stays at zero shots." : `Max ${item.maxShots} shots`,
          onInput: (value) => Message.ChangedShots({ value }),
        },
        h,
      ),
    ],
    h,
  );
}

function drinkSelect(model: Model, composer: Composer, h: Builder) {
  return selectField(
    {
      id: "order-drink",
      label: "Drink",
      value: composer.draft.drinkId,
      options: model.menu.map((entry) => ({ label: entry.name, value: entry.id })),
      onChange: (drinkId) => Message.ClickedSelectDrink({ drinkId }),
    },
    h,
  );
}

/** The frequency table's suggestion: one tap back to the drink this customer orders most. */
function usualChip(model: Model, h: Builder) {
  return Option.match(usualDraft(model.orders, model.menu), {
    onNone: () => [],
    onSome: (usual) => [
      h.div(
        [h.Class("flex flex-wrap items-center gap-2")],
        [
          button(
            {
              attributes: [h.OnClick(Message.ClickedUseUsual())],
              size: "sm",
              variant: "secondary",
            },
            [
              `Your usual: ${usual.size} ${toLabel(usual.milk === "none" ? "" : `${usual.milk} `)}${
                model.menu.find((item) => item.id === usual.drinkId)?.name ?? usual.drinkId
              }`,
            ],
            h,
          ),
        ],
      ),
    ],
  });
}

function orderFields(model: Model, composer: Composer, h: Builder) {
  const { draft } = composer;
  return h.div(
    [h.Class("grid gap-4")],
    [
      ...usualChip(model, h),
      drinkPicker(model, composer, h),
      drinkSelect(model, composer, h),
      sizeAndMilk(composer, h),
      temperatureAndShots(composer, h),
      fieldRow(
        [
          textField(
            {
              id: "order-quantity",
              label: "Quantity",
              type: "number",
              min: 1,
              value: String(draft.quantity),
              onInput: (value) => Message.ChangedQuantity({ value }),
            },
            h,
          ),
        ],
        h,
      ),
      textAreaField(
        {
          id: "order-notes",
          label: "Notes",
          value: draft.notes,
          placeholder: "No lid, extra dry, quick pickup...",
          helperText: "Optional barista note.",
          onInput: (value) => Message.ChangedNotes({ value }),
        },
        h,
      ),
    ],
  );
}

export function composerCard(model: Model, h: Builder) {
  return Option.match(composerFor(model.menu, model.draft), {
    onNone: () =>
      alert(
        { status: "info", surface: "card", title: "Loading customer tools" },
        ["Waiting for the menu to arrive from the backend."],
        h,
      ),
    onSome: (composer) =>
      card(
        { className: "w-full" },
        [
          cardTitleHeader("Build an order", "Menu constraints come from the backend.", h),
          cardContent(
            { className: "grid gap-5 lg:grid-cols-order-composer" },
            [orderFields(model, composer, h), orderPreview(model, composer, h)],
            h,
          ),
        ],
        h,
      ),
  });
}

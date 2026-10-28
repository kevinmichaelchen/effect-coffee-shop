import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { Model } from "./model.ts";
import { Message } from "./message.ts";
import { Select } from "@foldkit/ui";
import { menuItems, findMenuItem, drinkSizes } from "@effect-coffee-shop/coffee-domain/Menu/Menu";
import { button, field, select, dollars } from "./controls.ts";
export const composer = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class("panel composer")],
    [
      h.p([h.Class("eyebrow")], ["MADE YOUR WAY"]),
      h.h2([], ["Your next cup"]),
      drinkSelect(model, h),
      select("Size", "size", drinkSizes, model)(h),
      customization(model, h),
      field("Quantity", "quantity", model.draft.quantity, (value) =>
        Message.ChangedDraft({ field: "quantity", value }),
      )(h),
      field("Special instructions", "notes", model.draft.notes, (value) =>
        Message.ChangedDraft({ field: "notes", value }),
      )(h),
      button(
        model.pending ? "Placing order…" : "Place order",
        Message.SubmittedOrder(),
        h,
        model.pending,
      ),
    ],
  );

const drinkSelect = (model: Model, h: HtmlBuilder<Message>) =>
  Select.view(
    {
      id: "drink",
      value: model.draft.drinkId,
      onChange: (drinkId) => Message.SelectedDrink({ drinkId }),
      toView: (a) =>
        h.div(
          [h.Class("field")],
          [
            h.label(a.label, ["Drink"]),
            h.select(
              a.select,
              menuItems.map((item) =>
                h.option(
                  [h.Value(item.id)],
                  [`${item.name} · from ${dollars(item.basePrice.minorUnits)}`],
                ),
              ),
            ),
          ],
        ),
    },
    h,
  );

const customization = (model: Model, h: HtmlBuilder<Message>) =>
  Option.match(findMenuItem(model.draft.drinkId), {
    onNone: () => h.empty,
    onSome: (item) =>
      h.div(
        [h.Class("fields")],
        [
          select("Milk", "milk", item.availableMilks, model)(h),
          select("Temperature", "temperature", item.availableTemperatures, model)(h),
          select(
            "Shots",
            "shots",
            Array.from({ length: item.maxShots + 1 }, (_, index) => String(index)),
            model,
          )(h),
        ],
      ),
  });

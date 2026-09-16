/**
 * Resolves valid customization options for a selected menu item.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { DrinkNotFoundError } from "@effect-coffee-shop/coffee-domain/errors";
import {
  defaultMilkFor,
  defaultShotsFor,
  defaultTemperatureFor,
  drinkSizes,
} from "@effect-coffee-shop/coffee-domain/menu";
import { Quantity } from "@effect-coffee-shop/coffee-domain/order-primitives";
import type { ItemOptions, ItemOptionsRequest } from "../contracts.ts";
import { InternalAppError, internalAppErrorFromPersistence } from "../errors.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";

const defaultQuantity = Schema.decodeUnknownSync(Quantity)(1);

export const getItemOptions = Effect.fn("CoffeeOrders.getItemOptions")(function* (
  request: ItemOptionsRequest,
): Effect.fn.Return<ItemOptions, DrinkNotFoundError | InternalAppError, MenuRepository> {
  const menuRepository = yield* MenuRepository;
  const item = yield* menuRepository.findById(request.drinkId).pipe(
    Effect.mapError(internalAppErrorFromPersistence("Unable to load menu item right now")),
    Effect.flatMap((item) =>
      Effect.fromOption(item, () => new DrinkNotFoundError({ drinkId: request.drinkId })),
    ),
  );

  return {
    item,
    availableSizes: drinkSizes,
    defaultSize: "medium",
    defaultMilk: defaultMilkFor(item),
    defaultTemperature: defaultTemperatureFor(item),
    defaultShots: defaultShotsFor(item),
    defaultQuantity,
  };
});

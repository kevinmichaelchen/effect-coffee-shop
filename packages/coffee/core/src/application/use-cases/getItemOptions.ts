/**
 * Resolves valid customization options for a selected menu item.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { DrinkNotFoundError } from "../../domain/errors.ts";
import {
  defaultMilkFor,
  defaultShotsFor,
  defaultTemperatureFor,
  drinkSizes,
} from "../../domain/menu.ts";
import { QuantitySchema } from "../../domain/order-primitives.ts";
import type { ItemOptions, ItemOptionsRequest } from "../contracts.ts";
import { InternalAppError, internalAppErrorFromPersistence } from "../errors.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";

const defaultQuantity = Schema.decodeUnknownSync(QuantitySchema)(1);

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

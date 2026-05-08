import * as Effect from "effect/Effect";
import type { Menu } from "@effect-coffee-shop/coffee-core/domain/menu";
import {
  InternalAppError,
  internalAppErrorFromPersistence,
} from "@effect-coffee-shop/coffee-core/service/errors";
import { MenuRepository } from "../ports/MenuRepository.ts";

export const listMenu = Effect.fn("CoffeeOrders.listMenu")(function* (): Effect.fn.Return<
  Menu,
  InternalAppError,
  MenuRepository
> {
  const menuRepository = yield* MenuRepository;
  return yield* menuRepository.list.pipe(
    Effect.mapError(internalAppErrorFromPersistence("Unable to load menu right now")),
  );
});

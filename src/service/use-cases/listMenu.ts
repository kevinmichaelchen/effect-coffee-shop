import * as Effect from "effect/Effect";
import type { Menu } from "#domain/menu";
import { MenuRepository } from "../ports/MenuRepository.ts";

export const listMenu = Effect.fn("CoffeeOrders.listMenu")(function* (): Effect.fn.Return<
  Menu,
  never,
  MenuRepository
> {
  const menuRepository = yield* MenuRepository;
  return yield* menuRepository.list;
});

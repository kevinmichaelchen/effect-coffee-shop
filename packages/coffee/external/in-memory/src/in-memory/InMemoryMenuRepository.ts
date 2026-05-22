/**
 * Serves the built-in Coffee menu from memory.
 *
 * @module
 */
import * as Cache from "effect/Cache";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { menuItems } from "@effect-coffee-shop/coffee-core/domain/menu";
import { MenuRepository } from "@effect-coffee-shop/coffee-core/application/ports/MenuRepository";

export const InMemoryMenuRepositoryLive = Layer.effect(
  MenuRepository,
  Effect.gen(function* () {
    const menuItemCache = yield* Cache.make({
      capacity: menuItems.length,
      lookup: (drinkId: string) =>
        Effect.succeed(Option.fromUndefinedOr(menuItems.find((item) => item.id === drinkId))),
      timeToLive: "1 hour",
    });

    return MenuRepository.of({
      list: Effect.succeed(menuItems),
      findById: (drinkId) => Cache.get(menuItemCache, drinkId),
    });
  }),
);

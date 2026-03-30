import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { menuItems } from "#domain/menu";
import { MenuRepository } from "#service/ports/MenuRepository";

export const InMemoryMenuRepositoryLive = Layer.succeed(MenuRepository)({
  list: Effect.succeed(menuItems),
  findById: (drinkId) =>
    Effect.succeed(Option.fromUndefinedOr(menuItems.find((item) => item.id === drinkId))),
});

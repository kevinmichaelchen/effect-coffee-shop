import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { menuItems } from "#domain/menu";
import { MenuRepository } from "#service/ports/MenuRepository";

export const InMemoryMenuRepositoryLive = Layer.succeed(MenuRepository)({
  list: Effect.succeed(menuItems),
  findById: (drinkId) => Effect.succeed(menuItems.find((item) => item.id === drinkId)),
});

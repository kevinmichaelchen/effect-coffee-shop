import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { menuItems } from "../../domain/menu.ts"
import { MenuRepository } from "../../service/ports/MenuRepository.ts"

export const InMemoryMenuRepositoryLive = Layer.succeed(MenuRepository)({
  list: Effect.succeed(menuItems),
  findById: Effect.fn("InMemoryMenuRepository.findById")(function*(drinkId: string) {
    return menuItems.find((item) => item.id === drinkId)
  })
})

import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Context from "effect/Context";
import type { Menu, MenuItem } from "@effect-coffee-shop/coffee-core/domain/menu";
import type { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";

export class MenuRepository extends Context.Service<
  MenuRepository,
  {
    readonly list: Effect.Effect<Menu, PersistenceError>;
    readonly findById: (
      drinkId: string,
    ) => Effect.Effect<Option.Option<MenuItem>, PersistenceError>;
  }
>()("effect-coffee-shop/application/MenuRepository") {}

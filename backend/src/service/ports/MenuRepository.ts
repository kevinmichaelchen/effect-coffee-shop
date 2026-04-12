import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Context from "effect/Context";
import type { Menu, MenuItem } from "#domain/menu";
import type { PersistenceError } from "#service/errors";

export class MenuRepository extends Context.Service<
  MenuRepository,
  {
    readonly list: Effect.Effect<Menu, PersistenceError>;
    readonly findById: (
      drinkId: string,
    ) => Effect.Effect<Option.Option<MenuItem>, PersistenceError>;
  }
>()("effect-coffee-shop/service/MenuRepository") {}

import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as ServiceMap from "effect/ServiceMap";
import type { Menu, MenuItem } from "#domain/menu";

export class MenuRepository extends ServiceMap.Service<
  MenuRepository,
  {
    readonly list: Effect.Effect<Menu>;
    readonly findById: (drinkId: string) => Effect.Effect<Option.Option<MenuItem>>;
  }
>()("effect-v4-onion/service/MenuRepository") {}

import type * as Effect from "effect/Effect";
import * as ServiceMap from "effect/ServiceMap";
import type { Menu, MenuItem } from "#domain/menu";

export class MenuRepository extends ServiceMap.Service<
  MenuRepository,
  {
    readonly list: Effect.Effect<Menu>;
    readonly findById: (drinkId: string) => Effect.Effect<MenuItem | undefined>;
  }
>()("effect-v4-onion/service/MenuRepository") {}

import * as Effect from "effect/Effect";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import {
  decodeEmptyActionInput,
  decodeListOrdersInput,
  decodeOrderIdInput,
  decodePlaceOrderInput,
} from "./schemas.ts";
import type { CoffeeActionName } from "./specs.ts";

export type CoffeeAppRunner = <A, E>(effect: Effect.Effect<A, E, CoffeeOrderApp>) => Promise<A>;

export async function executeCoffeeAction(input: {
  readonly action: CoffeeActionName;
  readonly payload: unknown;
  readonly runApp: CoffeeAppRunner;
}): Promise<unknown> {
  switch (input.action) {
    case "list_menu":
      await decodeEmptyActionInput(input.payload ?? {});
      return input.runApp(CoffeeOrderApp.use((app) => app.listMenu()));
    case "place_order": {
      const payload = await decodePlaceOrderInput(input.payload ?? {});
      return input.runApp(CoffeeOrderApp.use((app) => app.placeOrder(payload)));
    }
    case "get_order": {
      const payload = await decodeOrderIdInput(input.payload ?? {});
      return input.runApp(CoffeeOrderApp.use((app) => app.getOrder(payload.orderId)));
    }
    case "list_orders": {
      const payload = await decodeListOrdersInput(input.payload ?? {});
      return input.runApp(CoffeeOrderApp.use((app) => app.listOrders(payload)));
    }
    case "start_brewing": {
      const payload = await decodeOrderIdInput(input.payload ?? {});
      return input.runApp(CoffeeOrderApp.use((app) => app.startBrewing(payload.orderId)));
    }
    case "mark_ready": {
      const payload = await decodeOrderIdInput(input.payload ?? {});
      return input.runApp(CoffeeOrderApp.use((app) => app.markReady(payload.orderId)));
    }
    case "pick_up_order": {
      const payload = await decodeOrderIdInput(input.payload ?? {});
      return input.runApp(CoffeeOrderApp.use((app) => app.pickUpOrder(payload.orderId)));
    }
    case "cancel_order": {
      const payload = await decodeOrderIdInput(input.payload ?? {});
      return input.runApp(CoffeeOrderApp.use((app) => app.cancelOrder(payload.orderId)));
    }
  }
}

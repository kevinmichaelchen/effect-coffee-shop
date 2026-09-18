import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import { drinkIds, drinkSizes, milks, temperatures } from "@effect-coffee-shop/coffee-domain/menu";
import { orderIdFromString, orderStatuses } from "@effect-coffee-shop/coffee-domain/order";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import {
  toCoffeeOrderView,
  toCoffeeOrdersView,
  toMenuView,
} from "@effect-coffee-shop/coffee-application/contracts";
import { prettyJson } from "./json.ts";

const customerName = Flag.String("customer-name").pipe(
  Flag.withAlias("c"),
  Flag.withDescription("Customer display name"),
);

const createOrder = Command.make("create", {
  customerName,
  drink: Flag.Literals("drink", drinkIds).pipe(Flag.withDescription("Drink identifier")),
  size: Flag.Literals("size", drinkSizes).pipe(Flag.withDefault("medium")),
  milk: Flag.Literals("milk", milks).pipe(Flag.optional),
  temperature: Flag.Literals("temperature", temperatures).pipe(Flag.optional),
  shots: Flag.Int("shots").pipe(Flag.optional),
  notes: Flag.String("notes").pipe(Flag.optional),
}).pipe(
  Command.withDescription("Create a new coffee order"),
  Command.withHandler(
    Effect.fn("CoffeeCli.createOrder")(function* ({
      customerName,
      drink,
      size,
      milk,
      temperature,
      shots,
      notes,
    }) {
      const app = yield* CoffeeOrderApp;
      const order = yield* app.placeOrder({
        customerName,
        items: [
          {
            drinkId: drink,
            size,
            ...Option.match(milk, { onNone: () => ({}), onSome: (milk) => ({ milk }) }),
            ...Option.match(temperature, {
              onNone: () => ({}),
              onSome: (temperature) => ({ temperature }),
            }),
            ...Option.match(shots, { onNone: () => ({}), onSome: (shots) => ({ shots }) }),
            ...Option.match(notes, { onNone: () => ({}), onSome: (notes) => ({ notes }) }),
          },
        ],
      });
      yield* Console.log(prettyJson(toCoffeeOrderView(order)));
    }),
  ),
);

const getOrderCommand = Command.make("get", {
  orderId: Flag.String("order-id").pipe(Flag.withAlias("i")),
}).pipe(
  Command.withDescription("Fetch an order by id"),
  Command.withHandler(
    Effect.fn("CoffeeCli.getOrder")(function* ({ orderId }) {
      const app = yield* CoffeeOrderApp;
      const order = yield* app.getOrder(orderIdFromString(orderId));
      yield* Console.log(prettyJson(toCoffeeOrderView(order)));
    }),
  ),
);

const listOrdersCommand = Command.make("list", {
  status: Flag.Literals("status", orderStatuses).pipe(Flag.optional),
}).pipe(
  Command.withDescription("List orders"),
  Command.withHandler(
    Effect.fn("CoffeeCli.listOrders")(function* ({ status }) {
      const app = yield* CoffeeOrderApp;
      const orders = yield* app.listOrders(
        Option.match(status, { onNone: () => ({}), onSome: (status) => ({ status }) }),
      );
      yield* Console.log(prettyJson(toCoffeeOrdersView(orders)));
    }),
  ),
);

const cancelOrderCommand = Command.make("cancel", {
  orderId: Flag.String("order-id").pipe(Flag.withAlias("i")),
}).pipe(
  Command.withDescription("Cancel an order"),
  Command.withHandler(
    Effect.fn("CoffeeCli.cancelOrder")(function* ({ orderId }) {
      const app = yield* CoffeeOrderApp;
      const order = yield* app.cancelOrder(orderIdFromString(orderId));
      yield* Console.log(prettyJson(toCoffeeOrderView(order)));
    }),
  ),
);

const order = Command.make("order").pipe(
  Command.withDescription("Order management commands"),
  Command.withSubcommands([createOrder, getOrderCommand, listOrdersCommand, cancelOrderCommand]),
);

const listMenuCommand = Command.make("list").pipe(
  Command.withDescription("Show the menu"),
  Command.withHandler(
    Effect.fn("CoffeeCli.listMenu")(function* () {
      const app = yield* CoffeeOrderApp;
      const menu = yield* app.listMenu();
      yield* Console.log(prettyJson(toMenuView(menu)));
    }),
  ),
);

const menu = Command.make("menu").pipe(
  Command.withDescription("Menu commands"),
  Command.withSubcommands([listMenuCommand]),
);

const startCommand = Command.make("start", {
  orderId: Flag.String("order-id").pipe(Flag.withAlias("i")),
}).pipe(
  Command.withDescription("Move an order into brewing"),
  Command.withHandler(
    Effect.fn("CoffeeCli.startBrewing")(function* ({ orderId }) {
      const app = yield* CoffeeOrderApp;
      const order = yield* app.startBrewing(orderIdFromString(orderId));
      yield* Console.log(prettyJson(toCoffeeOrderView(order)));
    }),
  ),
);

const readyCommand = Command.make("ready", {
  orderId: Flag.String("order-id").pipe(Flag.withAlias("i")),
}).pipe(
  Command.withDescription("Mark an order as ready"),
  Command.withHandler(
    Effect.fn("CoffeeCli.markReady")(function* ({ orderId }) {
      const app = yield* CoffeeOrderApp;
      const order = yield* app.markReady(orderIdFromString(orderId));
      yield* Console.log(prettyJson(toCoffeeOrderView(order)));
    }),
  ),
);

const pickupCommand = Command.make("pickup", {
  orderId: Flag.String("order-id").pipe(Flag.withAlias("i")),
}).pipe(
  Command.withDescription("Mark an order as picked up"),
  Command.withHandler(
    Effect.fn("CoffeeCli.pickUpOrder")(function* ({ orderId }) {
      const app = yield* CoffeeOrderApp;
      const order = yield* app.pickUpOrder(orderIdFromString(orderId));
      yield* Console.log(prettyJson(toCoffeeOrderView(order)));
    }),
  ),
);

const barista = Command.make("barista").pipe(
  Command.withDescription("Barista workflow commands"),
  Command.withSubcommands([startCommand, readyCommand, pickupCommand]),
);

const coffeeCli = Command.make("coffee").pipe(
  Command.withDescription("Coffee order demo application"),
  Command.withSubcommands([menu, order, barista]),
);

export const runCoffeeCli = Command.run(coffeeCli, {
  version: "0.1.0",
});

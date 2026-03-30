import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import { drinkIds, drinkSizes, milks, temperatures } from "#domain/menu";
import { orderStatuses } from "#domain/order";
import {
  cancelOrder,
  getOrder,
  listMenu,
  listOrders,
  markReady,
  pickUpOrder,
  placeOrder,
  startBrewing,
} from "#service/use-cases/index";
import { prettyJson } from "../shared/json.ts";

const customerName = Flag.string("customer-name").pipe(
  Flag.withAlias("c"),
  Flag.withDescription("Customer display name"),
);

const createOrder = Command.make("create", {
  customerName,
  drink: Flag.choice("drink", drinkIds).pipe(Flag.withDescription("Drink identifier")),
  size: Flag.choice("size", drinkSizes).pipe(Flag.withDefault("medium")),
  milk: Flag.choice("milk", milks).pipe(Flag.optional),
  temperature: Flag.choice("temperature", temperatures).pipe(Flag.optional),
  shots: Flag.integer("shots").pipe(Flag.optional),
  notes: Flag.string("notes").pipe(Flag.optional),
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
      const order = yield* placeOrder({
        customerName,
        drinkId: drink,
        size,
        ...(Option.isSome(milk) ? { milk: milk.value } : {}),
        ...(Option.isSome(temperature) ? { temperature: temperature.value } : {}),
        ...(Option.isSome(shots) ? { shots: shots.value } : {}),
        ...(Option.isSome(notes) ? { notes: notes.value } : {}),
      });
      yield* Console.log(prettyJson(order));
    }),
  ),
);

const getOrderCommand = Command.make("get", {
  orderId: Flag.string("order-id").pipe(Flag.withAlias("i")),
}).pipe(
  Command.withDescription("Fetch an order by id"),
  Command.withHandler(
    Effect.fn("CoffeeCli.getOrder")(function* ({ orderId }) {
      const order = yield* getOrder(orderId);
      yield* Console.log(prettyJson(order));
    }),
  ),
);

const listOrdersCommand = Command.make("list", {
  status: Flag.choice("status", orderStatuses).pipe(Flag.optional),
}).pipe(
  Command.withDescription("List orders"),
  Command.withHandler(
    Effect.fn("CoffeeCli.listOrders")(function* ({ status }) {
      const orders = yield* listOrders(Option.isSome(status) ? { status: status.value } : {});
      yield* Console.log(prettyJson(orders));
    }),
  ),
);

const cancelOrderCommand = Command.make("cancel", {
  orderId: Flag.string("order-id").pipe(Flag.withAlias("i")),
}).pipe(
  Command.withDescription("Cancel an order"),
  Command.withHandler(
    Effect.fn("CoffeeCli.cancelOrder")(function* ({ orderId }) {
      const order = yield* cancelOrder(orderId);
      yield* Console.log(prettyJson(order));
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
      const menu = yield* listMenu();
      yield* Console.log(prettyJson(menu));
    }),
  ),
);

const menu = Command.make("menu").pipe(
  Command.withDescription("Menu commands"),
  Command.withSubcommands([listMenuCommand]),
);

const startCommand = Command.make("start", {
  orderId: Flag.string("order-id").pipe(Flag.withAlias("i")),
}).pipe(
  Command.withDescription("Move an order into brewing"),
  Command.withHandler(
    Effect.fn("CoffeeCli.startBrewing")(function* ({ orderId }) {
      const order = yield* startBrewing(orderId);
      yield* Console.log(prettyJson(order));
    }),
  ),
);

const readyCommand = Command.make("ready", {
  orderId: Flag.string("order-id").pipe(Flag.withAlias("i")),
}).pipe(
  Command.withDescription("Mark an order as ready"),
  Command.withHandler(
    Effect.fn("CoffeeCli.markReady")(function* ({ orderId }) {
      const order = yield* markReady(orderId);
      yield* Console.log(prettyJson(order));
    }),
  ),
);

const pickupCommand = Command.make("pickup", {
  orderId: Flag.string("order-id").pipe(Flag.withAlias("i")),
}).pipe(
  Command.withDescription("Mark an order as picked up"),
  Command.withHandler(
    Effect.fn("CoffeeCli.pickUpOrder")(function* ({ orderId }) {
      const order = yield* pickUpOrder(orderId);
      yield* Console.log(prettyJson(order));
    }),
  ),
);

const barista = Command.make("barista").pipe(
  Command.withDescription("Barista workflow commands"),
  Command.withSubcommands([startCommand, readyCommand, pickupCommand]),
);

export const coffeeCli = Command.make("coffee").pipe(
  Command.withDescription("Coffee order demo application"),
  Command.withSubcommands([menu, order, barista]),
);

export const runCoffeeCli = Command.run(coffeeCli, {
  version: "0.1.0",
});

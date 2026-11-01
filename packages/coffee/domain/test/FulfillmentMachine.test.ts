import { describe, expect, it } from "@effect/vitest";
import { Machine } from "@typeonce/effect-machine";
import * as Effect from "effect/Effect";

// A deliberately small experiment: events represent facts already committed by an aggregate.
const Events = Machine.events({ BrewStarted: {}, DrinkReady: {}, CustomerNotified: {} });
const Fulfillment = Machine.make({
  events: Events,
  root: Machine.state({
    type: "parallel",
    states: {
      Preparation: { states: { Pending: {}, Brewing: {}, Ready: {} } },
      Notification: { states: { Waiting: {}, Sent: {} } },
    },
  }),
}).handle({
  states: {
    Preparation: {
      initial: { target: "Preparation.Pending" },
      states: {
        Pending: { on: { BrewStarted: { target: "Preparation.Brewing" } } },
        Brewing: { on: { DrinkReady: { target: "Preparation.Ready" } } },
        Ready: {},
      },
    },
    Notification: {
      initial: { target: "Notification.Waiting" },
      states: {
        Waiting: { on: { CustomerNotified: { target: "Notification.Sent" } } },
        Sent: {},
      },
    },
  },
});

describe("fulfillment statechart experiment", () => {
  it.effect("replays committed facts into independent preparation and notification states", () =>
    Effect.gen(function* () {
      const initial = yield* Machine.planInitial(Fulfillment);
      const brewed = yield* Machine.plan(Fulfillment, initial.state, Events.BrewStarted());
      const ready = yield* Machine.plan(Fulfillment, brewed.next, Events.DrinkReady());
      const notified = yield* Machine.plan(Fulfillment, ready.next, Events.CustomerNotified());
      const replayBrewed = yield* Machine.plan(Fulfillment, initial.state, Events.BrewStarted());
      const replayReady = yield* Machine.plan(Fulfillment, replayBrewed.next, Events.DrinkReady());
      const replayNotified = yield* Machine.plan(
        Fulfillment,
        replayReady.next,
        Events.CustomerNotified(),
      );
      expect(ready.next.states.Preparation.state.path).toBe("Preparation.Ready");
      expect(ready.next.states.Notification.state.path).toBe("Notification.Waiting");
      expect(notified.next.states.Notification.state.path).toBe("Notification.Sent");
      expect(notified.next).toEqual(replayNotified.next);
      expect(ready.next).not.toEqual(notified.next);
      expect(notified.commands).toEqual([]);
    }),
  );
});

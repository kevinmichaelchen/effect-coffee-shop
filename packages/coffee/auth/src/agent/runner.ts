import type { AgentSession } from "@better-auth/agent-auth";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { CoffeeAppRunner } from "@effect-coffee-shop/coffee-actions/execute";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import { CurrentActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { emptyWebHandlerServices } from "@effect-coffee-shop/http-routing/request-services";

const toAgentActor = (session: AgentSession) => ({
  displayName: session.user.name.trim() || session.user.email,
  kind: "customer" as const,
  userId: session.user.id,
});

export type CoffeeAgentAppLayer = Layer.Layer<never, any, any>;

const provideCoffeeOrderApp = (appLayer: CoffeeAgentAppLayer) =>
  CoffeeOrderApp.layer.pipe(Layer.provide(appLayer));

export function createCoffeeAgentAppRunner(input: {
  readonly appLayer: CoffeeAgentAppLayer;
  readonly session: AgentSession;
}): CoffeeAppRunner {
  const liveLayer = provideCoffeeOrderApp(input.appLayer);
  const services = emptyWebHandlerServices().pipe(
    Context.add(CurrentActor, toAgentActor(input.session)),
  );

  return <A, E>(effect: Effect.Effect<A, E, CoffeeOrderApp>) =>
    effect.pipe(Effect.provide(liveLayer), Effect.provide(services));
}

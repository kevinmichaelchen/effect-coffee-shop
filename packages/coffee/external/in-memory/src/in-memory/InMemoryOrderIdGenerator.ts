/**
 * Provides deterministic in-memory order identifiers.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import { OrderIdFactory } from "@effect-coffee-shop/coffee-domain/order";
import { OrderIdGenerator } from "@effect-coffee-shop/coffee-application/ports/OrderIdGenerator";
import { makeTypeIdGenerator } from "@effect-coffee-shop/coffee-application/ports/type-id-generator";

export const InMemoryOrderIdGeneratorLive = Layer.succeed(
  OrderIdGenerator,
  OrderIdGenerator.of(makeTypeIdGenerator(OrderIdFactory)),
);

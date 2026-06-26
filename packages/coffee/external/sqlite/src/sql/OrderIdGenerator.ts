/**
 * Allocates Coffee order identifiers from the SQL backing store.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import { OrderIdFactory } from "@effect-coffee-shop/coffee-core/domain/order";
import { OrderIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/OrderIdGenerator";
import { makeTypeIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/type-id-generator";

export const SqlOrderIdGeneratorLive = Layer.succeed(
  OrderIdGenerator,
  OrderIdGenerator.of(makeTypeIdGenerator(OrderIdFactory)),
);

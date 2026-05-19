import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { orderIdFromString } from "@effect-coffee-shop/coffee-core/domain/order";
import { OrderIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/OrderIdGenerator";
import {
  makeMonotonicIdGenerator,
  makePaddedIdFormatter,
} from "@effect-coffee-shop/coffee-core/application/ports/monotonic-id-generator";

const formatOrderId = makePaddedIdFormatter("order", orderIdFromString);

export const SqlOrderIdGeneratorLive = Layer.effect(
  OrderIdGenerator,
  makeMonotonicIdGenerator(formatOrderId).pipe(Effect.map(OrderIdGenerator.of)),
);

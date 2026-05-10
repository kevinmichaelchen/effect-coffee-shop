import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import { type CoffeeOrder } from "@effect-coffee-shop/coffee-core/domain/order";
import {
  AuthenticationRequiredError,
  requireSignedInActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import {
  InternalAppError,
  internalAppErrorFromPersistence,
} from "@effect-coffee-shop/coffee-core/application/errors";
import {
  actorObservabilityAttributes,
  annotateObservabilitySpan,
  logInfoWithAttributes,
} from "@effect-coffee-shop/coffee-core/application/observability";
import { OrderIdGenerator } from "../ports/OrderIdGenerator.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { OrderRepository } from "../ports/OrderRepository.ts";
import { type PlaceOrderRequest } from "../contracts.ts";
import { invalidOrderInput, resolveOrderQuote } from "./orderItems.ts";

const decodeTrimmedString = Schema.decodeUnknownSync(Schema.Trim);

const validateCustomerName = Effect.fnUntraced(function* (
  customerName: string,
): Effect.fn.Return<string, InvalidOrderInputError> {
  return yield* Effect.succeed(decodeTrimmedString(customerName)).pipe(
    Effect.filterOrFail(
      (trimmedCustomerName) => trimmedCustomerName.length > 0,
      () => invalidOrderInput("customerName must not be blank"),
    ),
  );
});

export const placeOrder = Effect.fn("CoffeeOrders.placeOrder")(function* (
  request: PlaceOrderRequest,
): Effect.fn.Return<
  CoffeeOrder,
  AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  MenuRepository | OrderIdGenerator | OrderRepository
> {
  const actor = yield* requireSignedInActor();
  const orderIdGenerator = yield* OrderIdGenerator;
  const orderRepository = yield* OrderRepository;
  const customerNameByActorKind = {
    customer: Effect.succeed(actor.displayName),
    staff: Effect.succeed(actor.displayName),
    system: validateCustomerName(request.customerName ?? actor.displayName),
  };
  const customerName = yield* customerNameByActorKind[actor.kind];

  yield* annotateObservabilitySpan({
    ...actorObservabilityAttributes(actor),
    order_action: "place",
  });

  const quote = yield* resolveOrderQuote(request.items);
  const id = yield* orderIdGenerator.next;
  const createdAt = yield* DateTime.now;

  const order: CoffeeOrder = {
    id,
    customerName,
    ownerUserId: actor.userId,
    items: quote.items,
    status: "pending",
    totalPrice: quote.totalPrice,
    createdAt,
  };

  const savedOrder = yield* orderRepository
    .save(order)
    .pipe(Effect.mapError(internalAppErrorFromPersistence("Unable to place order right now")));

  yield* logInfoWithAttributes("coffee order placed", {
    ...actorObservabilityAttributes(actor),
    order_action: "place",
    order_id: savedOrder.id,
    order_status: savedOrder.status,
  });

  return savedOrder;
});

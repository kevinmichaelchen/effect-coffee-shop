import * as Match from "effect/Match";
import * as Option from "effect/Option";
import type * as Effect from "effect/Effect";
import {
  decodeCartItemIdInput,
  decodeCheckoutCartInput,
  decodeEmptyActionInput,
  decodeItemOptionsInput,
  decodeListOrdersInput,
  decodeOrderIdInput,
  decodeOrderItemInput,
  decodePlaceOrderInput,
  decodeQuoteOrderInput,
  decodeUpdateCartItemInput,
} from "@effect-coffee-shop/coffee-actions/schemas";
import type { CoffeeActionName } from "@effect-coffee-shop/coffee-actions/specs";

export type AgentInputDecoder<A> = (value: unknown) => Effect.Effect<A, unknown>;

export interface AgentActionInput {
  readonly action: CoffeeActionName;
  readonly decode: AgentInputDecoder<unknown>;
  readonly failureMessage: string;
}

const agentActionInput = (
  action: CoffeeActionName,
  decode: AgentInputDecoder<unknown>,
): AgentActionInput => ({
  action,
  decode,
  failureMessage: `Invalid ${action} arguments.`,
});

export const agentActionInputFor = (capability: string): Option.Option<AgentActionInput> =>
  Match.value(capability).pipe(
    Match.when("list_menu", () =>
      Option.some(agentActionInput("list_menu", decodeEmptyActionInput)),
    ),
    Match.when("get_item_options", () =>
      Option.some(agentActionInput("get_item_options", decodeItemOptionsInput)),
    ),
    Match.when("validate_order", () =>
      Option.some(agentActionInput("validate_order", decodeQuoteOrderInput)),
    ),
    Match.when("quote_order", () =>
      Option.some(agentActionInput("quote_order", decodeQuoteOrderInput)),
    ),
    Match.when("place_order", () =>
      Option.some(agentActionInput("place_order", decodePlaceOrderInput)),
    ),
    Match.when("get_order", () => Option.some(agentActionInput("get_order", decodeOrderIdInput))),
    Match.when("list_orders", () =>
      Option.some(agentActionInput("list_orders", decodeListOrdersInput)),
    ),
    Match.when("get_cart", () => Option.some(agentActionInput("get_cart", decodeEmptyActionInput))),
    Match.when("add_cart_item", () =>
      Option.some(agentActionInput("add_cart_item", decodeOrderItemInput)),
    ),
    Match.when("update_cart_item", () =>
      Option.some(agentActionInput("update_cart_item", decodeUpdateCartItemInput)),
    ),
    Match.when("remove_cart_item", () =>
      Option.some(agentActionInput("remove_cart_item", decodeCartItemIdInput)),
    ),
    Match.when("clear_cart", () =>
      Option.some(agentActionInput("clear_cart", decodeEmptyActionInput)),
    ),
    Match.when("prepare_cart_checkout", () =>
      Option.some(agentActionInput("prepare_cart_checkout", decodeEmptyActionInput)),
    ),
    Match.when("get_checkout_session", () =>
      Option.some(agentActionInput("get_checkout_session", decodeEmptyActionInput)),
    ),
    Match.when("checkout_cart", () =>
      Option.some(agentActionInput("checkout_cart", decodeCheckoutCartInput)),
    ),
    Match.orElse(() => Option.none()),
  );

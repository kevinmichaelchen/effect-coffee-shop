/**
 * Builds the Effect AI toolkit of the hand-written Coffee tools: the menu,
 * checks of a proposed order, and the ordering context. Orders, carts,
 * checkout and the staff lifecycle are generated from the domain Apis
 * (see `domain-tools.ts`).
 *
 * @module
 */
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import { coffeeActionSpecs } from "@effect-coffee-shop/coffee-actions/specs";

const GetOrderingContextTool = Tool.make(
  "get_ordering_context",
  coffeeActionSpecs.get_ordering_context,
);
const ListMenuTool = Tool.make("list_menu", coffeeActionSpecs.list_menu);
const GetItemOptionsTool = Tool.make("get_item_options", coffeeActionSpecs.get_item_options);
const ValidateOrderTool = Tool.make("validate_order", coffeeActionSpecs.validate_order);
const QuoteOrderTool = Tool.make("quote_order", coffeeActionSpecs.quote_order);

export const CoffeeActionToolkit = Toolkit.make(
  GetOrderingContextTool,
  ListMenuTool,
  GetItemOptionsTool,
  ValidateOrderTool,
  QuoteOrderTool,
);

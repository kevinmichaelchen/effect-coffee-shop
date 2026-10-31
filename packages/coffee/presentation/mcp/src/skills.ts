import * as McpServer from "effect/ai/McpServer";

/** Served as a static resource so Workers need no filesystem access. */
export const CoffeeOrderingSkill = McpServer.skill({
  uri: "skill://coffee/order-coffee/SKILL.md",
  files: {
    "SKILL.md": `---
name: order-coffee
description: Choose drinks, manage the signed-in customer's cart, and check out with the Coffee Orders MCP tools.
---

Read list_menu and get_item_options for current drink IDs, sizes, milk choices,
and defaults. Use returned prices and options rather than inventing them.

Read get_cart before editing an existing cart. Use add_cart_item,
update_cart_item, and remove_cart_item to apply the customer's choices;
preserve unrelated cart items. validate_order and quote_order can check a
proposed order without placing it.

Call prepare_cart_checkout after the cart is ready. Present the returned items
and total to the customer and obtain their confirmation before checkout_cart.
Pass the prepared checkoutSessionId. If the cart changes or the session expires,
prepare it again and confirm the new summary. After an uncertain checkout
response, inspect get_checkout_session and list_orders before attempting a new
checkout; do not create a duplicate order with place_order.

Report the order ID and status returned by checkout_cart. Use get_order for
status updates. Brewing, readiness, pickup, and cancellation tools require staff
authority; a customer's request does not grant it.
`,
  },
});

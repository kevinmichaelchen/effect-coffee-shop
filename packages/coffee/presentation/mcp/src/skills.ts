import * as McpServer from "effect/ai/McpServer";

/**
 * Served as a static resource so Workers need no filesystem access. Tool
 * names are in backticks, and a test checks each one is a served tool.
 */
export const CoffeeOrderingSkill = McpServer.skill({
  uri: "skill://coffee/order-coffee/SKILL.md",
  files: {
    "SKILL.md": `---
name: order-coffee
description: Choose drinks, manage the signed-in customer's cart, and check out with the Coffee Orders MCP tools.
---

Start with \`get_ordering_context\`. Its customerId is the target of every cart
command and the key of \`CustomerApi_Cart_get\` and
\`CustomerApi_CustomerOrders_get\`. Its newIds are fresh ids for a new cart line
(cartItemId), checkout (checkoutId) and order (orderId); call it again whenever
you need more. Never invent ids.

Read \`list_menu\` and \`get_item_options\` for current drink IDs, sizes, milk
choices, and defaults. Use returned prices and options rather than inventing
them. \`validate_order\` and \`quote_order\` check a proposed order without
placing it.

Read \`CustomerApi_Cart_get\` before editing an existing cart. Use
\`CustomerApi_AddCartItem_send\`, \`CustomerApi_UpdateCartItem_send\`, and
\`CustomerApi_RemoveCartItem_send\` to apply the customer's choices; preserve
unrelated cart items. Each command takes a target, an input, and an optional
commandId: resending with the same commandId returns the first result instead
of applying the command twice.

Call \`CustomerApi_PrepareCheckout_send\` with a new checkoutId once the cart is
ready. Present the returned items and total to the customer and obtain their
confirmation before \`CustomerApi_ConfirmCheckout_send\`, which takes that
checkoutId and a new orderId. If the cart changes or the checkout expires,
prepare it again and confirm the new summary. After an uncertain confirmation,
resend it with the same commandId, or read \`CustomerApi_Cart_get\` and
\`CustomerApi_OrderSummary_get\` for the orderId, before trying again; do not
create a duplicate order with \`CustomerApi_PlaceOrder_send\`.

The order is placed moments after confirmation. Report its orderId, and use
\`CustomerApi_OrderSummary_get\` (keyed by orderId) for its status. A failure
such as Unauthorized, NotYourCart or CheckoutExpired comes back as the tool's
result: act on it rather than retrying blindly. The StaffApi tools (the queue,
brewing, readiness, pickup, and cancellation) require staff authority; a
customer's request does not grant it.
`,
  },
});

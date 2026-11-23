# Coffee Domain

`@effect-coffee-shop/coffee-domain` is the coffee shop as an
[`@alchemy.run/domain`](https://main.alchemy.run/domain/what-is-ddd/) model: commands that aggregates
decide, events they record, views that fold those events, and a policy that reacts. The same model
runs in memory for tests and on Durable Objects or Rivet in production, hosted by
[`coffee-server`](../server).

![Order lifecycle: pending to brewing to ready to picked-up, with cancellation allowed while pending or brewing](../../../docs/architecture/order-lifecycle.svg)

`decide` in `Order.aggregate.ts` refuses every other move with `InvalidStatusTransition`, including
repeated, skipped and backward steps.

<details>
<summary>Building blocks</summary>

Files follow the alchemy-domain layout: one building block per file, named `<Noun>.<kind>.ts`, with
folders as subdomains. Import them by path, e.g.
`@effect-coffee-shop/coffee-domain/Order/Order.aggregate`. Contracts use `@alchemy.run/domain` and
`effect`; Alchemy core and the Cloudflare, AWS, and Domain packages are pinned together at
preview commit `8b2e29a` in the workspace catalog.

| Building block | Files                                                                                    | What it does                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Aggregate      | [`Order/Order.aggregate.ts`](src/Order/Order.aggregate.ts)                               | One ticket, keyed by `OrderId`: placed once, then moved along its lifecycle by staff.                                                     |
| Aggregate      | [`Cart/Cart.aggregate.ts`](src/Cart/Cart.aggregate.ts)                                   | One person's cart, keyed by `CustomerId`: its lines and the checkout awaiting confirmation. Confirming empties the cart in the same step. |
| Aggregate      | [`Customer/Customer.aggregate.ts`](src/Customer/Customer.aggregate.ts)                   | Key only: views about one customer are keyed by it. It decides nothing yet.                                                               |
| Key            | [`Shop/Shop.id.ts`](src/Shop/Shop.id.ts)                                                 | A Schema key: views about the whole shop are keyed by `ShopId` directly, with no aggregate behind it.                                     |
| View           | [`Order/OrderSummary.view.ts`](src/Order/OrderSummary.view.ts)                           | One ticket as people read it. Staff read any; a customer only their own.                                                                  |
| View           | [`Order/CustomerOrders.view.ts`](src/Order/CustomerOrders.view.ts)                       | Every order one customer placed, folded from `OrderSummary`.                                                                              |
| View           | [`Order/OrderQueue.view.ts`](src/Order/OrderQueue.view.ts)                               | The baristas' queue: open orders plus the 200 most recent finished ones. Staff only.                                                      |
| View           | [`Cart/CustomerCart.view.ts`](src/Cart/CustomerCart.view.ts)                             | One person's cart as they read it, folded from the same events as `Cart`. Owner only.                                                     |
| Decision       | [`Cart/CheckoutFulfillment.decision.ts`](src/Cart/CheckoutFulfillment.decision.ts)       | Confirm the checkout and place the order at its frozen prices in one commit.                                                              |
| Api            | [`CustomerApi.api.ts`](src/CustomerApi.api.ts), [`StaffApi.api.ts`](src/StaffApi.api.ts) | What each audience may send and read.                                                                                                     |
| Model          | [`CoffeeShop.model.ts`](src/CoffeeShop.model.ts)                                         | Everything hosted together, plus read guards as one Layer.                                                                                |

Commands live in `<Command>.command.ts` with the events they record and the rejections only they
return. Shared rejections have their own `*.rejection.ts` files.

| Aggregate | Commands                                                                                             | Events                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Order`   | `PlaceOrder`, `StartBrewing`, `MarkReady`, `PickUpOrder`, `CancelOrder`                              | `OrderPlaced`, `BrewingStarted`, `OrderReady`, `OrderPickedUp`, `OrderCancelled`                              |
| `Cart`    | `AddCartItem`, `UpdateCartItem`, `RemoveCartItem`, `ClearCart`, `PrepareCheckout`, `ConfirmCheckout` | `CartItemAdded`, `CartItemUpdated`, `CartItemRemoved`, `CartCleared`, `CheckoutPrepared`, `CheckoutConfirmed` |

Rejections carry their evidence: `DrinkNotFound { drinkId }`, `InvalidOrder { message }`,
`InvalidStatusTransition { orderId, from, to }`, `OrderNotFound`, `AlreadyPlaced`, `StaffOnly`,
`NotYourOrder`, `NotYourCart`, `CartItemNotFound`, `CheckoutNotFound`, `CheckoutExpired`.

</details>

<details>
<summary>Checkout</summary>

![Checkout commits the cart and order together](../../../docs/architecture/checkout-flow.svg)

`PrepareCheckout` holds prices for 15 minutes. `CheckoutFulfillment` records confirmation on the
cart and placement on the order in one decision. An existing order ID rejects a new checkout
without clearing the cart.

</details>

<details>
<summary>Who may do what</summary>

`Session` ([`Session.middleware.ts`](src/Session.middleware.ts)) authenticates a request and provides
`CurrentActor` ([`CurrentActor.context.ts`](src/CurrentActor.context.ts)): a `customer`, `staff`, or
`system` [`Actor`](src/Actor.ts). Each command's `decide` and each view's Layer (`View.toLayer`)
authorizes against it:

- Anyone signed in may place orders and use their own cart (a cart is keyed by its owner).
- Only staff (and the system) may move tickets or read the queue.
- Customers read only their own tickets and order lists.

Staff authority comes from deployment configuration (`COFFEE_STAFF_USER_IDS`), never from the
session.

</details>

<details>
<summary>Values and tests</summary>

[`Menu/`](src/Menu) holds the static menu and pricing. [`Menu/OrderItem.ts`](src/Menu/OrderItem.ts)
prices a `DrinkSelection` (menu choices with defaults) as pure functions returning `Result`, so
`decide` can price a request and reject it in the same step. [`Money.ts`](src/Money.ts) keeps exact
cents. Ids (`OrderId`, `CartItemId`, `CheckoutId`) are prefixed, time-ordered strings made by whoever
sends the creating command ([`TypedId.ts`](src/TypedId.ts)), so a retried command addresses the same
instance.

[`test/CoffeeShop.story.test.ts`](test/CoffeeShop.story.test.ts) specifies the model with stories:
given events, when a command is sent, then the events, replies, rejections and view states that
follow. The policy runs for real. Unit tests cover pricing, money, the menu and the lifecycle table.

```bash
bun run --cwd packages/coffee/domain test
bun run --cwd packages/coffee/domain lint
```

The server's [`CoffeeApis.test.ts`](../server/test/CoffeeApis.test.ts) drives the Apis over the
in-memory platform. The Alchemy stack test (`bun run cf:test`) runs the model on locally emulated
Durable Objects, and `bun run rivet:test` runs it on Rivet.

</details>

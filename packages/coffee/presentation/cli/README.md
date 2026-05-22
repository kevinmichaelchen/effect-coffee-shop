# Coffee CLI

`@effect-coffee-shop/coffee-cli` adapts `CoffeeOrderApp` to Effect CLI commands.

The CLI is a presentation surface for local development and operational smoke checks. It formats
application views as JSON and relies on the composition root to provide the concrete Coffee
application layer.

## Command Surface

- `coffee menu list`: print the menu.
- `coffee order create`: place a customer order.
- `coffee order get`: fetch one order by id.
- `coffee order list`: list orders, optionally by status.
- `coffee order cancel`: cancel a pending or brewing order.
- `coffee barista start`: move an order into brewing.
- `coffee barista ready`: mark an order ready.
- `coffee barista pickup`: mark an order picked up.

## Boundary Rule

CLI flags and command formatting belong here. Business rules stay in
[`coffee-core/application`](../../core/src/application), and runtime persistence choices stay in the
[`backend app`](../../../../apps/backend) that runs the command.

## Commands

```bash
bun run --cwd apps/backend cli -- --help
bun run --cwd packages/coffee/presentation/cli typecheck
bun run --cwd packages/coffee/presentation/cli lint
bun run --cwd packages/coffee/presentation/cli lint:custom
bun run --cwd packages/coffee/presentation/cli fmt:check
bun run --cwd packages/coffee/presentation/cli test
```

# UI Kit

`@effect-coffee-shop/ui-kit` provides React primitives, composed fields, theme
controls, and class utilities. Each component has its own export, for example
`@effect-coffee-shop/ui-kit/components/retroui/Button`. It has no app or Coffee
feature dependencies. The order-specific StatusBadge belongs to the app.

The kit lint task explicitly hashes the app theme CSS alongside its default
package inputs. The app owns the theme CSS; its Tailwind `@source` includes this package. Both
components.json files route generated components here. The kit uses the UI lint
policy, with implementation allowances confined to `src/components` and the
inline transform allowance confined to Progress. Custom boundary rules are built
from `apps/ui/.lintcn`; Turbo hashes that build into both consumers.

Storybook remains in `apps/ui` and discovers both app and kit stories. Run
`bun run test:storybook` for light/dark browser interactions and accessibility
checks. The kit's `test` task is a no-test unit-test gate; the browser suite belongs
to the consuming app and is invalidated by the kit's workspace dependency.

Run `typecheck`, `lint`, `lint:custom`, and `fmt:check` with
`bun run --cwd packages/ui-kit <task>`.

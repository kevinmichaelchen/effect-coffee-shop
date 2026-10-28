# UI Kit

`@effect-coffee-shop/ui-kit` provides Foldkit view primitives (button, card, badge, alert,
fields, table, progress, toast, overlay), the theme preference, and class utilities. Each
component has its own export, for example `@effect-coffee-shop/ui-kit/components/button`. It has
no app or Coffee feature dependencies. The order-specific status badge belongs to the app.

Primitives are plain functions `(props, children, h)` that return Foldkit HTML, so they hold no
state: the app's Model owns it. The `overlay` helper styles a `@foldkit/ui` Dialog as a modal or
a right-hand drawer, and `selectField` renders a native `<select>`.

The app owns the theme CSS; its Tailwind `@source` includes this package. The kit uses the UI
lint policy, and the custom boundary rules are built from `apps/ui/.lintcn`; Turbo hashes that
build into both consumers. The kit's `test` task is a no-test gate; UI behavior is tested in the
consuming app with Foldkit Story and Scene tests.

Run `typecheck`, `lint`, `lint:custom`, and `fmt:check` with
`bun run --cwd packages/ui-kit <task>`.

# UI checks

Run `bun run --cwd apps/ui check` from the repository root after UI changes.

- The app is Foldkit. State lives in one Model; only `update` changes it. Views are pure and
  take the HTML builder `h` as the last argument. Side effects are named Commands
  (`src/app/command.ts`) or Subscriptions that report back as Messages.
- Decode external input once, in the Command that fetches it, and put typed values in the Message.
  Command error channels are empty: turn failures into `Failed*` Messages.
- Build UI from `@effect-coffee-shop/ui-kit/components/*` view functions. Feature views pass
  layout classes; the kit owns appearance (variants, tokens from `src/index.css`).
- Dialogs and drawers use the `@foldkit/ui` Dialog Submodel through the kit's `overlay`.
  Do not hand-roll focus traps, scroll locks, or Escape handling.
- Add a `foldkit/story` test for each new Message and a `foldkit/scene` test for new UI. Keep
  Api and passkey modules mocked there.
- The `@shadcn/lint` design-system rules were removed with JSX; they read JSX `className` props
  and cannot see `h.Class(...)`. Keep class strings inside the kit and review new treatments
  by hand: add a variant or semantic token rather than a one-off color or arbitrary value.

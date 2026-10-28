# UI

- State lives in the Model; only `update` changes it. Effects are Commands or Subscriptions.
- Build views from `@effect-coffee-shop/ui-kit/components/*`; add a variant instead of one-off classes.
- Overlays use the `@foldkit/ui` Dialog through the kit's `overlay`.
- New Message: add a `foldkit/story` test. New UI: add a `foldkit/scene` test.

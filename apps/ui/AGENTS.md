# UI design-system checks

Run `bun run --cwd apps/ui check` from the repository root after UI changes.
`lint` includes all six `@shadcn/lint` rules through Oxlint; the root Turbo/CI
lint tasks already run it. Do not add a second shadcn plugin to ESLint.

- Import primitives from `#shared/ui/retroui`; `components.json` and
  `settings.shadcn.ui` identify that directory. Keep aliases synchronized.
- Use Button sizes/variants for appearance. Callers may control layout.
- Use Card and Alert `surface` props for background treatments. Use semantic
  colors from `src/index.css`, including status and alert tokens.
- Text permits typography and theme colors; Card content/header and table
  cells permit composition/spacing according to `.oxlintrc.json` contracts.
  Drawer borders/surfaces and dialog description text have explicit allowances.
- Compound component contracts use resolved names (`CardComponentContent`,
  `TableObjCell`, etc.), not the JSX spelling (`Card.Content`). Verify lint
  findings when changing exports or contract patterns.
- Put reusable layout values in named theme tokens/utilities. The composer
  and customer workspace grid utilities preserve their sidebar proportions.
- `src/shared/ui` is the design-system implementation boundary: it may define
  styles, arbitrary geometry, and forward class values. Theme-color and valid
  Tailwind-class checks still apply there. Feature code must use its API.
- Progress alone may set inline `transform` for its runtime numeric value;
  other inline styles remain checked. Do not broaden this exception.

When a rule reports an intentional new treatment, add a meaningful variant,
semantic token, or narrowly scoped contract. Do not blanket-disable checks to
silence a finding. Keep the light/dark Storybook interaction tests passing.

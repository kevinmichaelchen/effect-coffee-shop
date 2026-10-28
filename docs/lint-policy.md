# Lint

- Effect workspaces extend the recommended `@mpsuesser/oxlint-plugin-effect` preset; the UI has its own policy in `apps/ui/.oxlintrc.json`.
- Every Oxlint policy is type-aware. Typecheck is `tsrs --noEmit` plus `effect-tsrs diagnostics`.
- Custom Go rules live in `packages/tooling/.lintcn` (backend) and `apps/ui/.lintcn` (UI).
- Fallow and Knip gate unused code; `bun run check` runs everything, prek runs it on commit and push.
- Disable a rule on the affected line only, with a reason. Unused disables fail lint.

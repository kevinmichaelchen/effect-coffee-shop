# UI kit checks

Use the UI policy in `.oxlintrc.json`, not the backend Effect policy. Keep this package free
of imports from apps and Coffee features. Primitives are Foldkit view functions
`(props, children, h)`; implementation styles belong in `src/components`, and callers pass
layout only. Preserve the semantic variants and light/dark tokens.

After changes run the kit's typecheck, lint, lint:custom, and fmt:check tasks, then
`bun run test` and `bun run build` from the repository root.

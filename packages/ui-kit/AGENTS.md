# UI kit checks

Use the UI policy in `.oxlintrc.json`, not the backend Effect policy. Keep this
package free of imports from apps and Coffee features. Import individual exported
components. Implementation styles belong in `src/components`; only Progress may
set an inline transform. Preserve semantic variants and the light/dark stories.

After changes run the kit's typecheck, lint, lint:custom, and fmt:check tasks, then
`bun run test:storybook` and `bun run build` from the repository root.

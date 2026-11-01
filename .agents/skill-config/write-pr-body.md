# write-pr-body overrides

- Keep PR images uncommitted, in `.context/diagrams/`; attach them with `gh pr create|edit --attach`. Commit an image only when it is an SVG intentionally included in a README.
- Dependency-refresh diagram sources and the renderer live in `docs/diagrams/` (see its README). Reuse them for dependency-refresh PRs; they are not mandatory elsewhere.
- Say whether a diagram shows new capability or existing architecture, and whether it describes agent guidance or server-enforced behavior.
- Do not call the whole check suite green when only selected checks passed.

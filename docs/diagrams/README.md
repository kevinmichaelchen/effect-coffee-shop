# PR diagrams

Sources for one past PR, the dependency refresh, and the system it ran within. Labels marked
**NEW** identify the adopted behavior; the checkout diagram describes assistant guidance, not a new
server-side confirmation mechanism.

<details>
<summary>Render and attach</summary>

Sources are Mermaid text in `dependency-refresh/*.mmd`, rendered by
[Pele](https://github.com/obsidianmd/pele) 1.13.0 to SVG. PNGs are captured from those SVGs in
Chrome for PR attachments. Generated SVGs and PNGs stay uncommitted in `.context/diagrams/`.

Regenerate from the repository root with Node 26 and Chrome installed:

```sh
mkdir -p .context/diagram-tools
printf '{"private":true,"type":"module"}\n' > .context/diagram-tools/package.json
npm install --prefix .context/diagram-tools --ignore-scripts --no-audit --no-fund pele@1.13.0 playwright-core@1.64.1
node docs/diagrams/render.mjs
```

Set `CHROME` if Chrome is not at `/usr/bin/google-chrome`. Review PNGs after editing source
diagrams. In the PR body table, reference the local attachment paths (for example
`![Architecture](.context/diagrams/architecture.png)`), then upload them:

```sh
gh pr edit <number> --body-file .context/pr-body.md \
  --attach .context/diagrams/architecture.png \
  --attach .context/diagrams/checkout.png \
  --attach .context/diagrams/auth.png
```

The CLI rewrites matching references to hosted attachment URLs. Read back the PR body to verify all
three images. Do not commit generated images unless an SVG is intentionally included in a README.

</details>

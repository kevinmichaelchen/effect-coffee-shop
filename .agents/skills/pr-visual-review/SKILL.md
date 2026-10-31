---
name: pr-visual-review
description: Write or update this project's pull request descriptions using image tables and concise FAQs. Use when preparing a PR, explaining its architecture, or revising its review materials.
---

Kevin prefers tables of images and FAQs because long prose is difficult to scan.

- Lead with one sentence stating the concrete problem and resulting behavior.
- Explain substantial architecture or workflow changes with a few focused diagrams rendered using [obsidianmd/pele](https://github.com/obsidianmd/pele). Put actual rendered images in a Markdown table in the PR body, with short captions and descriptive alt text. Keep diagrams readable at PR width; use one large image per row when needed.
- Prefer a short question/answer table for rationale, behavior changes, compatibility, risks, and follow-up work. Use a compact validation table for passed, failed, and incomplete checks. State existing failures honestly; do not label the whole check suite green when only selected checks passed.
- Default to uncommitted PR images in `.context/`. Upload them as PR attachments with `gh pr edit --attach`; do not commit PNGs or other image assets merely to obtain a URL. Commit an image only when it is an SVG intentionally included in a README. Editable diagram sources and rendering instructions may be tracked separately.
- Inspect rendered images before uploading. Write the image table with local file references matching the attachment paths, then use `gh pr edit <number> --body-file <file> --attach <image>` (repeat `--attach` for multiple images). The CLI uploads the files and rewrites matching body references to hosted asset URLs, preserving the table and its alt text. Without a body flag it retains the existing body and appends attachments.
- The attachment syntax supports `--attach './image.png#Description'`; existing body references retain their own alt text. Up to 50 files may be attached per command. A partial upload can still update the PR and exit nonzero: read back the body, preserve successful uploads, and retry only missing files. Verify the resulting hosted URLs; do not leave local paths or expiring preview URLs in the published body. If the installed CLI lacks `--attach`, report that limitation rather than committing images as a workaround.
- Paths in a body file resolve relative to that file's directory, falling back to the working directory. Ensure they resolve to the files passed to `--attach`.
- Match the diagrams to the implemented code. Distinguish new capabilities from existing architecture, and instructions for an agent from guarantees enforced by the server.
- Keep simple changes simple: a tiny fix may need only the FAQ and validation tables. Avoid decorative diagrams that do not explain behavior.
- Inspect the existing PR body and preserve relevant context when updating it. Write the complete body to a file, then use `gh pr edit <number> --body-file <file>` so Markdown and newlines survive shell quoting. See the [GitHub CLI manual](https://cli.github.com/manual/gh_pr_edit).
- This preference does not itself authorize publishing, merging, deployment, or unrelated external actions. Follow the current user's task authorization.

Example (the body file contains `![System architecture](.context/diagrams/architecture.png)` inside its table):

```sh
gh pr edit 129 --body-file .context/pr-body.md \
  --attach '.context/diagrams/architecture.png#System architecture'
```

The dependency-refresh source diagrams and renderer are in `docs/diagrams/`; generated images belong in `.context/diagrams/`. Reuse their approach when useful, without treating their specific diagram count or layout as mandatory.

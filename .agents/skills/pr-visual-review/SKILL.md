---
name: pr-visual-review
description: Write or update this project's pull request descriptions using image tables and concise FAQs. Use when preparing a PR, explaining its architecture, or revising its review materials.
---

Kevin prefers tables of images and FAQs because long prose is difficult to scan.

- Lead with one sentence stating the concrete problem and resulting behavior.
- Explain substantial architecture or workflow changes with a few focused diagrams rendered using [obsidianmd/pele](https://github.com/obsidianmd/pele). Put actual rendered images in a Markdown table in the PR body, with short captions and descriptive alt text. Keep diagrams readable at PR width; use one large image per row when needed.
- Prefer a short question/answer table for rationale, behavior changes, compatibility, risks, and follow-up work. Use a compact validation table for passed, failed, and incomplete checks. State existing failures honestly; do not label the whole check suite green when only selected checks passed.
- Keep source diagrams and generated assets together in `docs/diagrams/`, with reproducible rendering instructions. Use durable GitHub-accessible image URLs, preferably pinned to the pushed commit. Local `.context` paths and expiring preview URLs cannot serve as PR attachments. Inspect the rendered images before publishing and verify the image URLs afterward.
- Match the diagrams to the implemented code. Distinguish new capabilities from existing architecture, and instructions for an agent from guarantees enforced by the server.
- Keep simple changes simple: a tiny fix may need only the FAQ and validation tables. Avoid decorative diagrams that do not explain behavior.
- Inspect the existing PR body and preserve relevant context when updating it. Write the complete body to a file, then use `gh pr edit <number> --body-file <file>` so Markdown and newlines survive shell quoting. See the [GitHub CLI manual](https://cli.github.com/manual/gh_pr_edit).
- This preference does not itself authorize publishing, merging, deployment, or unrelated external actions. Follow the current user's task authorization.

The dependency-refresh examples and renderer are in `docs/diagrams/`. Reuse their approach when useful, without treating their specific diagram count or layout as mandatory.

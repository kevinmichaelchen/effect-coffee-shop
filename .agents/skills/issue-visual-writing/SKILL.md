---
name: issue-visual-writing
description: Create or revise GitHub issues for this project using Pele diagram attachments, concise tables, FAQs, and verifiable acceptance criteria. Also use when proposing issue cleanup; do not apply to ordinary code changes.
---

Kevin prefers tables of images and FAQs because long prose is difficult to scan.

- Lead with the concrete problem and desired outcome. Use a short title describing the work, not a vague topic.
- Prefer tables for current versus expected behavior, options, evidence, dependencies, and acceptance criteria. Use a concise FAQ for rationale, scope, tradeoffs, and open questions. Make completion observable with checkboxes or a small acceptance table.
- Use [obsidianmd/pele](https://github.com/obsidianmd/pele) to render diagrams when architecture, a workflow, or a comparison helps explain the issue. Put rendered images in a Markdown table with short captions and descriptive alt text. Keep them readable at issue width; one large image per row is often best. Do not force a diagram into a trivial issue.
- Distinguish proposed behavior from the implemented system. Link relevant code, PRs, and issues; verify version-specific claims rather than copying stale assumptions from an older issue.
- Keep generated SVGs and PNGs uncommitted under `.context/`. Upload images as issue attachments. Do not commit images merely to obtain URLs; only commit an SVG when intentionally including it in a README. Editable sources and reproducible rendering instructions may be tracked separately. The Pele renderer in `docs/diagrams/` is a useful example, not a required diagram layout.

## Create an issue with attachments

Read [the GitHub CLI manual](https://cli.github.com/manual/gh_issue_create) and check `gh issue create --help` when needed. Use `--attach` explicitly; a local Markdown image reference alone does not upload a file.

Write the complete body to a file. For example, `.context/issue-body.md` can contain:

```markdown
| Proposed flow                  | Diagram                                                 |
| ------------------------------ | ------------------------------------------------------- |
| Reconnect after a dropped feed | ![Proposed feed reconnect flow](diagrams/reconnect.png) |

| FAQ                | Answer                                                                              |
| ------------------ | ----------------------------------------------------------------------------------- |
| When is this done? | An integration test proves the feed resumes without accepting stale-account events. |
```

Then publish within the user's authorized task:

```sh
gh issue create --title "Test order-feed reconnection" \
  --body-file .context/issue-body.md \
  --attach '.context/diagrams/reconnect.png#Proposed feed reconnect flow'
```

- Repeat `--attach` for multiple files; the CLI supports up to 50 per command. It uploads each file and rewrites matching body references to hosted asset URLs, preserving the image table and its alt text. Unreferenced attachments are appended to the body.
- Paths inside a body file resolve relative to that file's directory, falling back to the working directory. In the example, `diagrams/reconnect.png` resolves under `.context/` and matches the attachment.
- `--attach '<file>#<alt text>'` supplies image alt text when the body does not already provide it. Video attachments render as players and cannot have alt text.
- Inspect images before publishing. Read back the created issue and verify its image table and hosted URLs afterward. Never leave local paths or expiring preview URLs as published attachments.
- A partial upload can **create the issue despite a nonzero exit status**; its URL is still printed. Read back that issue and repair only missing attachments with `gh issue edit --attach` after checking its help. Do not rerun `gh issue create` blindly and create duplicates.
- If the installed CLI lacks `--attach`, report that limitation rather than committing images as a workaround.

## Issue cleanup

Inspect open issues, their discussions, linked PRs, and relevant current code before proposing closure or consolidation. Present a table of issue, evidence, recommended action, and remaining work. Separate completed work, duplicates, stale descriptions, upstream blockers, and still-actionable tasks; age alone is not evidence of completion.

When asked to think about cleanup, propose concrete changes first without modifying issues. When asked to perform cleanup, act within that scope and preserve useful history and links. This skill does not itself authorize creating, closing, commenting on, labeling, or otherwise changing issues.

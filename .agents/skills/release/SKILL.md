---
name: release
description: Cut and push a GitHub release (annotated vX.Y.Z tag plus release notes) for the coffee shop after a significant architecture or feature change lands on main. Use when a change adds, removes or replaces a host, domain capability, sign-in method, API surface or major dependency, or when asked to tag, version or release.
---

Releases mark milestones a reader would care about, not every commit. The Git
tag is the only record of the version: there is no version in `package.json`
and no `CHANGELOG.md`.

## When to release

Release, without asking, after one of these lands on `main` and passes the
pre-push hook:

| Release | Examples                                                                                                                                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Yes     | A new model host or edge (Rivet, Effect Cluster, AWS), a new aggregate, command set or saga, a new API surface (MCP, REST), a new sign-in method, removing a subsystem (Yielded Sync), a framework upgrade that changes how code is written (Alchemy beta, Effect major) |
| No      | Refactors, renames, lint or tooling changes, tests, docs, dependency bumps with no behaviour change                                                                                                                                                                      |

Several small changes that together change what the app can do also count.
When unsure, do not release; mention that a release may be due instead.

## Version

SemVer on `0.x` until the user declares `1.0.0`:

- Minor (`v0.4.0` → `v0.5.0`): every release from the table above.
- Patch (`v0.5.0` → `v0.5.1`): only for a fix to something the last release
  shipped broken.
- Never bump the major version yourself.

## Steps

1. Be on an up-to-date, clean `main`:

   ```sh
   git switch main && git pull --ff-only && git status --short
   ```

2. Find the previous release and read what changed since it:

   ```sh
   prev=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null)
   git log --oneline ${prev:+$prev..}HEAD
   ```

   No previous tag means this is the first release; start at `v0.1.0`.

3. Write the highlights to `.context/release-notes.md` (gitignored), in plain
   language for someone who knows the project but not the commits:

   ```markdown
   ## Highlights

   - One bullet per significant change: what the app or architecture can do
     now, and why it matters. Link the PR or commit.

   ## Upgrading

   Only if a developer must act: new env vars, migrations, commands that moved.
   ```

   Keep it under about 15 lines. If an architecture diagram in
   `docs/architecture/` changed, link its SVG on `main`.

4. Tag and push. Annotated tags only; the tag message is the release title:

   ```sh
   git tag -a vX.Y.Z -m "vX.Y.Z: <short title of the biggest change>"
   git push origin vX.Y.Z
   ```

5. Publish the GitHub release. `--generate-notes` appends GitHub's list of
   merged PRs and the full-changelog link after the highlights, so do not
   list PRs by hand:

   ```sh
   gh release create vX.Y.Z --verify-tag --title "vX.Y.Z: <same title>" \
     --notes-file .context/release-notes.md --generate-notes \
     ${prev:+--notes-start-tag "$prev"}
   ```

6. Reply with the release URL and the highlights.

## Rules

- Never move, delete or re-push an existing tag. To fix a bad release, cut
  a patch release; to fix only its notes, use `gh release edit`.
- Never release from a branch other than `main`, or with uncommitted changes.
- Commits pushed straight to `main` do not appear in GitHub's generated list;
  cover them in the highlights.

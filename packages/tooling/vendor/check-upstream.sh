#!/usr/bin/env bash
# Reports drift between our Oxlint rules and their upstream sources.
#   1. Vendored anti-slop files: local edits since the pinned commit, and
#      upstream commits since then that touch them.
#   2. Rules upstream (Kyle's fork and Dillon's original) that we lack and
#      have not declined in upstream.json.
#   3. Newer npm releases of the rule packages we depend on.
set -euo pipefail

tooling=$(cd "$(dirname "$0")/.." && pwd)
pin="$tooling/vendor/anti-slop/upstream.json"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

field() { bun -e "console.log((await Bun.file('$pin').json()).$1)"; }
repo=$(field repository)
commit=$(field commit)
files=$(bun -e "console.log((await Bun.file('$pin').json()).files.join('\n'))")

git clone --quiet "$repo" "$work/kyle"
git clone --quiet --depth 1 https://github.com/dmmulroy/anti-slop "$work/dillon"

echo "== Vendored files (pinned at ${commit:0:7}, upstream HEAD $(git -C "$work/kyle" rev-parse --short HEAD))"
for file in $files; do
  local_copy="$tooling/vendor/anti-slop/$file"
  git -C "$work/kyle" show "$commit:$file" | cmp -s - "$local_copy" || echo "  local edit: $file"
  git -C "$work/kyle" log --oneline "$commit..HEAD" -- "$file" | sed "s|^|  upstream ($file): |"
done

echo "== Upstream rules we neither have nor declined"
ours=$(cd "$tooling" && bun -e '
  import effect from "@mpsuesser/oxlint-plugin-effect";
  import antiSlop from "./oxlint-plugin-anti-slop.ts";
  const declined = Object.keys((await Bun.file("vendor/anti-slop/upstream.json").json()).declined);
  console.log([...Object.keys(effect.rules), ...Object.keys(antiSlop.rules), ...declined].join("\n"));
')
for source in kyle dillon; do
  find "$work/$source/src" -path '*/rules/*.ts' ! -name '*.test.ts' -exec basename {} .ts \; |
    sort | while read -r rule; do
      grep -qx "$rule" <<<"$ours" || echo "  $source: $rule"
    done
done

echo "== Rule packages"
(cd "$tooling" && bun outdated @mpsuesser/oxlint-plugin-effect @foldkit/oxlint-plugin @effect/tsgo oxlint @oxlint/plugins) || true

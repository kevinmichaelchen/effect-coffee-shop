#!/bin/sh
# Pre-push gate for release tags. prek runs it on every push; it acts only when
# the pushed ref is a v* tag, and then runs the slow checks that commits and
# ordinary pushes skip. Push a release tag on its own: prek reports one ref.
set -eu

ref="${PRE_COMMIT_LOCAL_BRANCH:-}"
case "$ref" in
  refs/tags/v*) ;;
  *) exit 0 ;;
esac
tag="${ref#refs/tags/}"

fail() {
  echo "release gate: $tag: $1" >&2
  exit 1
}

echo "$tag" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$' || fail "name it vX.Y.Z"
[ "$(git cat-file -t "$ref")" = tag ] || fail "use an annotated tag (git tag -a)"
git fetch -q origin main
git merge-base --is-ancestor "$ref^{commit}" origin/main ||
  fail "tag a commit that is already on origin/main"
[ "$(git rev-parse "$ref^{commit}")" = "$(git rev-parse HEAD)" ] &&
  git diff --quiet HEAD ||
  fail "check out the tagged commit with a clean tree; the checks run on it"
docker info >/dev/null 2>&1 || fail "start Docker; the Rivet stack test needs it"

exec bun run check:release

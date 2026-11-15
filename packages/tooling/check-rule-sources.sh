#!/usr/bin/env bash
# Compares rule-sources.json with each upstream repository and with our
# Oxlint profiles. Reports, per source: upstream commits since we last
# reviewed it, rules upstream has that the registry does not mention, registry
# entries upstream no longer has, and edits to vendored copies. Then checks
# that every `adopted`/`covered` rule is enabled, and lists newer releases of
# the npm rule packages.
set -euo pipefail

tooling=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

for source in $(bun -e "console.log(Object.keys((await Bun.file('$tooling/rule-sources.json').json()).sources).join(' '))"); do
  repository=$(bun -e "console.log((await Bun.file('$tooling/rule-sources.json').json()).sources.$source.repository)")
  git clone --quiet "$repository" "$work/$source"
done

cd "$tooling"
WORK="$work" bun -e '
import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { backend, ui } from "./oxlint.profiles.ts";

const work = process.env.WORK;
const registry = JSON.parse(readFileSync("rule-sources.json", "utf8"));
const git = (source, ...args) => execFileSync("git", ["-C", `${work}/${source}`, ...args], { encoding: "utf8" }).trim();
let problems = 0;
const report = (line) => { problems += 1; console.log(`  ${line}`); };

const ruleFiles = (source, dirs) => dirs.flatMap((dir) =>
  readdirSync(`${work}/${source}/${dir}`).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts")).map((file) => file.slice(0, -3)));

for (const [source, entry] of Object.entries(registry.sources)) {
  const head = git(source, "rev-parse", "HEAD");
  console.log(`== ${source} (${entry.author}): reviewed ${entry.reviewed.slice(0, 7)}, upstream ${head.slice(0, 7)}`);
  const commits = git(source, "log", "--oneline", `${entry.reviewed}..HEAD`, "--", ...entry.ruleDirs);
  if (commits !== "") commits.split("\n").forEach((commit) => report(`rule change upstream: ${commit}`));
  const upstream = new Set(ruleFiles(source, entry.ruleDirs));
  [...upstream].filter((rule) => !(rule in entry.rules)).forEach((rule) => report(`undecided new rule: ${rule}`));
  Object.keys(entry.rules).filter((rule) => !upstream.has(rule)).forEach((rule) => report(`gone upstream: ${rule}`));
  for (const file of entry.vendored?.files ?? []) {
    const pinned = git(source, "show", `${entry.vendored.commit}:${file}`);
    const local = readFileSync(`${entry.vendored.into}/${file}`, "utf8").trim();
    if (pinned !== local) report(`vendored copy differs from ${entry.vendored.commit.slice(0, 7)}: ${file}`);
    const later = git(source, "log", "--oneline", `${entry.vendored.commit}..HEAD`, "--", file);
    if (later !== "") report(`vendored file changed upstream: ${file}`);
  }
}

const enabled = new Set([backend, ui].flatMap((profile) =>
  [profile, ...(profile.extends ?? []), ...(profile.overrides ?? [])].flatMap((config) =>
    Object.entries(config.rules ?? {}).filter(([, level]) => level !== "off" && (!Array.isArray(level) || level[0] !== "off")).map(([rule]) => rule))));
console.log("== registry rules missing from our profiles");
for (const [source, entry] of Object.entries(registry.sources)) {
  for (const [rule, decision] of Object.entries(entry.rules)) {
    const ours = decision.as ?? decision.by;
    if (ours === undefined) continue;
    ours.split(", ").filter((name) => !enabled.has(name)).forEach((name) => report(`${source}/${rule} points at ${name}, which no profile enables`));
  }
}
const candidates = Object.entries(registry.sources).flatMap(([source, entry]) =>
  Object.entries(entry.rules).filter(([, decision]) => decision.status === "candidate").map(([rule]) => `${source}/${rule}`));
console.log(`== ${candidates.length} candidates awaiting adoption: ${candidates.join(", ")}`);
process.exitCode = problems === 0 ? 0 : 1;
'
status=$?

echo "== npm rule packages"
bun outdated @mpsuesser/oxlint-plugin-effect @foldkit/oxlint-plugin @effect/tsgo oxlint @oxlint/plugins || true
exit $status

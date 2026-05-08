import * as FileSystem from "node:fs/promises";
import * as Path from "node:path";
import { describe, expect, it } from "vitest";

const presentationRoot = Path.resolve(
  Path.dirname(new URL(import.meta.url).pathname),
  "../../../presentation",
);

const forbiddenImportPatterns = [
  /from\s+["']@effect-coffee-shop\/backend(?:\/|["'])/,
  /from\s+["'][^"']*apps\/backend\/src\/cloudflare/,
  /from\s+["'][^"']*src\/cloudflare/,
  /from\s+["']#app-layer["']/,
];

const sourceFiles = async (directory = presentationRoot): Promise<ReadonlyArray<string>> => {
  const entries = await FileSystem.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = Path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return sourceFiles(path);
      }

      if (path.endsWith(".ts") && path.includes(`${Path.sep}coffee-`)) {
        return Promise.resolve([Path.relative(presentationRoot, path)]);
      }

      return Promise.resolve([]);
    }),
  );

  return nested.flat();
};

const fileViolations = async (path: string): Promise<ReadonlyArray<string>> => {
  const text = await FileSystem.readFile(Path.join(presentationRoot, path), "utf8");
  return forbiddenImportPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `${path} matches ${pattern.source}`);
};

describe("presentation package boundaries", () => {
  it("keeps presentation packages independent from backend deployment adapters", async () => {
    const violations = (await Promise.all((await sourceFiles()).map(fileViolations))).flat();

    expect(violations).toEqual([]);
  });
});

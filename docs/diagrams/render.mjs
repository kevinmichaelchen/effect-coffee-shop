// Run from the repository root; see README.md for isolated tool installation.
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const requireTool = createRequire(
  resolve(process.argv[2] ?? ".context/diagram-tools", "package.json"),
);
const { render } = requireTool("pele");
const { chromium } = requireTool("playwright-core");
const directory = resolve("docs/diagrams/dependency-refresh");
await mkdir(".context/diagrams", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 1600 },
  deviceScaleFactor: 2,
});
for (const file of (await readdir(directory)).filter((file) => file.endsWith(".mmd"))) {
  const name = file.slice(0, -4);
  const source = await readFile(resolve(directory, file), "utf8");
  const { svg } = render(source, {
    fontFamily: "Arial, sans-serif",
    fontSize: 18,
    padding: 28,
    responsive: false,
  });
  await writeFile(`.context/diagrams/${name}.svg`, svg);
  await page.setContent(
    `<html><head><style>body{margin:0;background:white}svg{display:block;background:white}</style></head><body>${svg}</body></html>`,
  );
  await page.locator("svg").screenshot({ path: `.context/diagrams/${name}.png` });
  console.log(`Rendered ${name} with Pele`);
}
await browser.close();

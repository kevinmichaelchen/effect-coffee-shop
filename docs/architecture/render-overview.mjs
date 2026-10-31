// Run from the repository root; see README.md for isolated tool installation.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const requireTool = createRequire(
  resolve(process.argv[2] ?? ".context/diagram-tools", "package.json"),
);
const { render } = requireTool("pele");
const { fitFrame, generateOrnament } = requireTool("@lauriparonen/alembic-ornaments");

const paper = "#fbf7ef";
const ink = "#2a211b";
const muted = "#6b5d52";
const theme = [
  `--pele-bg:${paper}`,
  `--pele-fg:${ink}`,
  `--pele-muted:${muted}`,
  `--pele-line:${ink}`,
  `--pele-surface:#f3ece0`,
  `--pele-surface-alt:#ebe2d3`,
  `--pele-border:${ink}`,
  `--pele-accent:${ink}`,
  "--pele-radius:2px",
].join(";");

const source = await readFile("docs/architecture/overview.mmd", "utf8");
const diagram = render(source, {
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: 16,
  padding: 8,
  responsive: false,
});

// Frame and ornaments are seeded, so the same seeds always redraw the same image.
const frameSize = 56;
const gap = 28;
const titleHeight = 96;
const footHeight = 64;
const width = Math.ceil(diagram.width + 2 * (frameSize + gap));
const height = Math.ceil(diagram.height + 2 * (frameSize + gap) + titleHeight + footHeight);
const frame = fitFrame({ preset: "border", seed: 7, size: frameSize }, width, height);
const garland = generateOrnament({ preset: "garland", seed: 7 });
const sprig = generateOrnament({ preset: "sprig", seed: 7 });

// Nest each drawing at a position, with its ids prefixed so the ornaments' defs cannot collide.
const place = (svg, prefix, x, y, w, h) =>
  svg
    .replace(
      /^<svg ([^>]*?)width="[^"]*" height="[^"]*"/,
      `<svg $1x="${x}" y="${y}" width="${w}" height="${h}"`,
    )
    .replaceAll('id="', `id="${prefix}-`)
    .replaceAll('href="#', `href="#${prefix}-`)
    .replaceAll("url(#", `url(#${prefix}-`);
const top = frame.inset + gap;
const garlandWidth = 200;
const sprigWidth = 44;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="effect-coffee-shop architecture: browser and MCP clients reach the Website Worker, which forwards to the Coffee Worker; its Effect RPC, REST, MCP, Yielded Auth and Yielded Sync surfaces run over event-sourced Durable Objects, Sync order feeds and D1 on Cloudflare, deployed by Alchemy.">
<rect width="${width}" height="${height}" fill="${paper}"/>
<g color="${ink}">${place(frame.svg, "frame", 0, 0, width, height)}</g>
<g color="${ink}">${place(garland.svg, "garland", (width - garlandWidth) / 2, top - 12, garlandWidth, garlandWidth / 4)}</g>
<text x="${width / 2}" y="${top + 76}" text-anchor="middle" fill="${ink}" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-style="italic" letter-spacing="1">effect-coffee-shop</text>
<g style="${theme}">${place(diagram.svg, "diagram", (width - diagram.width) / 2, top + titleHeight, diagram.width, diagram.height)}</g>
<g color="${ink}">${place(sprig.svg, "sprig", (width - sprigWidth) / 2, top + titleHeight + diagram.height + 16, sprigWidth, sprigWidth / 1.263)}</g>
</svg>
`;
await writeFile("docs/architecture/overview.svg", svg);
console.log(`Rendered docs/architecture/overview.svg (${width}×${height})`);

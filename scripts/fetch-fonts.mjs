import { writeFile, mkdir } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const OUT = new URL('../public/fonts/', import.meta.url).pathname;
const KEEP = new Set(['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext']);
const FAMILIES = [
  { slug: 'Cormorant+Garamond:ital,wght@0,400;0,600;1,400', short: 'cormorant' },
  { slug: 'Spectral:ital,wght@0,300;0,400;0,600;1,400', short: 'spectral' },
];

await mkdir(OUT, { recursive: true });
let css = `/* Self-hosted fonts. No external CDN at runtime — the app must load inside
   networks where Google Fonts is slow or unreachable, and it must work offline.
   Source: Google Fonts (Cormorant Garamond, Spectral — both SIL Open Font License 1.1).
   Regenerate with: node scripts/fetch-fonts.mjs */\n`;

for (const fam of FAMILIES) {
  const res = await fetch(`https://fonts.googleapis.com/css2?family=${fam.slug}&display=swap`, { headers: { 'User-Agent': UA } });
  const text = await res.text();
  const blocks = text.split('/*').slice(1);
  for (const raw of blocks) {
    const subset = raw.slice(0, raw.indexOf('*/')).trim();
    if (!KEEP.has(subset)) continue;
    const body = raw.slice(raw.indexOf('*/') + 2);
    const family = /font-family: '([^']+)'/.exec(body)[1];
    const style = /font-style: (\w+)/.exec(body)[1];
    const weight = /font-weight: (\d+)/.exec(body)[1];
    const url = /url\((https:[^)]+)\)/.exec(body)[1];
    const range = /unicode-range: ([^;]+);/.exec(body)[1];
    const name = `${fam.short}-${weight}-${style}-${subset}.woff2`;
    const bin = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
    await writeFile(`${OUT}/${name}`, bin);
    css += `\n@font-face {\n  font-family: '${family}';\n  font-style: ${style};\n  font-weight: ${weight};\n  font-display: swap;\n  src: url('/fonts/${name}') format('woff2');\n  unicode-range: ${range};\n}\n`;
    console.log(name, bin.length);
  }
}
await writeFile(`${OUT}/fonts.css`, css);

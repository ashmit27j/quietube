/**
 * Regenerates docs/FEATURES.md from src/lib/registry.js.
 * Run: node tools/gen-features.mjs
 *
 * registry.js is a classic script that publishes globalThis.QT, so we can just
 * evaluate it here — no parser, no build step, no drift between docs and code.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/lib/registry.js'), 'utf8');

// eslint-disable-next-line no-new-func
new Function(src)();
const { GROUPS, REGISTRY, MODE_META } = globalThis.QT;

const RISK = { low: 'low', med: 'med', high: '**high**' };
const tick = (b) => (b ? '✓' : '·');

let out = `# Feature reference

Generated from \`src/lib/registry.js\` by \`tools/gen-features.mjs\`.
**Do not edit by hand** — edit the registry and regenerate.

${REGISTRY.length} toggles across ${GROUPS.length} groups.

Columns: **S** = Study mode default, **M** = Music, **C** = Casual.
**Risk** is selector fragility — \`high\` means it depends on a YouTube class
name and should be checked first after a redesign.

`;

for (const g of GROUPS) {
  const items = REGISTRY.filter((f) => f.group === g.id);
  if (!items.length) continue;
  out += `## ${g.label}\n\n_${g.blurb}_\n\n`;
  out += `| Toggle | id | Page | Kind | Risk | S | M | C | What it does |\n`;
  out += `|---|---|---|---|---|:-:|:-:|:-:|---|\n`;
  for (const f of items) {
    const m = f.modes || {};
    out += `| ${f.label} | \`${f.id}\` | ${f.pages} | ${f.kind} | ${RISK[f.risk] || f.risk} | ${tick(m.study)} | ${tick(m.music)} | ${tick(m.casual)} | ${f.desc} |\n`;
  }
  out += '\n';
}

out += `## Modes\n\n`;
for (const [k, v] of Object.entries(MODE_META)) {
  out += `- **${v.label}** — ${v.blurb}\n`;
}

out += `
## Selector inventory

Every selector the extension uses, for audit purposes.

| id | risk | selectors |
|---|---|---|
`;
for (const f of REGISTRY.filter((f) => f.sel && f.sel.length)) {
  out += `| \`${f.id}\` | ${f.risk} | ${f.sel.map((s) => '`' + s + '`').join('<br>')} |\n`;
}

writeFileSync(join(root, 'docs/FEATURES.md'), out);
console.log(`docs/FEATURES.md written — ${REGISTRY.length} features`);

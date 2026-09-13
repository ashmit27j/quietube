/**
 * Regenerates docs/FEATURES.md from the YouTube pack's registry.
 * Run: node tools/gen-features.mjs
 *
 * The pack is a classic script that publishes globalThis.QS.pack, so we can
 * just evaluate it here — no parser, no build step, no drift between docs and
 * code. core/storage.js is loaded first only for the generic off/custom mode
 * metadata (see core/storage.js's OFF_META/CUSTOM_META).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
globalThis.chrome = { storage: { sync: { get: async () => ({}), set: async () => {} } } };

// eslint-disable-next-line no-new-func
new Function(readFileSync(join(root, 'src/core/storage.js'), 'utf8'))();
// eslint-disable-next-line no-new-func
new Function(readFileSync(join(root, 'src/packs/youtube.js'), 'utf8'))();

const { pack, storage } = globalThis.QS;
const { groups: GROUPS, features: REGISTRY } = pack;
const MODE_META = { off: storage.OFF_META, ...pack.modes, custom: storage.CUSTOM_META };

const RISK = { low: 'low', med: 'med', high: '**high**' };
const tick = (b) => (b ? '✓' : '·');

let out = `# Feature reference

Generated from \`src/packs/youtube.js\` by \`tools/gen-features.mjs\`.
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

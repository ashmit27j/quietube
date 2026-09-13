/**
 * Release gate. Fails loudly rather than letting a bad build reach the store.
 * Run: node tools/check-release.mjs   (or `npm run check`)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const warns = [];
const ok = [];

const check = (cond, msg, level = 'fail') =>
  cond ? ok.push(msg) : (level === 'fail' ? fails : warns).push(msg);

// ── manifest ──────────────────────────────────────────────────────────────
// D16: every site is an optional_host_permissions grant, requested on first
// use — host_permissions must stay empty and permissions must stay exactly
// storage + scripting (scripting is what dynamic per-pack registration
// costs; see background/pack-scripts.js). See DECISIONS.md D16 (supersedes
// D5's single-permission-set framing, kept for the "why so few" reasoning).
const manifest = JSON.parse(readFileSync(join(root, 'src/manifest.json'), 'utf8'));
check(manifest.manifest_version === 3, 'manifest_version is 3');
check(
  JSON.stringify(manifest.permissions) === JSON.stringify(['storage', 'scripting']),
  `permissions are exactly ["storage","scripting"] (found ${JSON.stringify(manifest.permissions)}) — see DECISIONS.md D16`
);
check(
  Array.isArray(manifest.host_permissions) && manifest.host_permissions.length === 0,
  `host_permissions is empty — every site is optional (found ${JSON.stringify(manifest.host_permissions)})`
);
check(
  Array.isArray(manifest.optional_host_permissions) && manifest.optional_host_permissions.length > 0,
  'optional_host_permissions lists at least one pack host'
);
check(/^\d+\.\d+\.\d+$/.test(manifest.version), `version "${manifest.version}" is semver`);
check(
  manifest.content_scripts === undefined,
  'no static content_scripts entry — packs register dynamically via chrome.scripting (D16)'
);

// ── icons ─────────────────────────────────────────────────────────────────
for (const size of [16, 32, 48, 128]) {
  check(existsSync(join(root, `src/icons/${size}.png`)), `icon ${size}.png exists`);
}

// ── no network code ───────────────────────────────────────────────────────
const srcFiles = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) srcFiles.push(p);
  }
})(join(root, 'src'));

const netRe = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new WebSocket/;
const offenders = srcFiles.filter((f) => netRe.test(readFileSync(f, 'utf8')));
check(
  offenders.length === 0,
  offenders.length
    ? `network code found in ${offenders.map((f) => f.replace(root + '/', '')).join(', ')} — the "nothing leaves your browser" claim is a release blocker`
    : 'no network code anywhere in src/'
);

// ── docs match the registry ───────────────────────────────────────────────
try {
  execSync('node tools/gen-features.mjs', { cwd: root, stdio: 'pipe' });
  const dirty = execSync('git status --porcelain docs/FEATURES.md', { cwd: root }).toString().trim();
  check(dirty === '', 'docs/FEATURES.md is up to date with the registry');
} catch {
  warns.push('could not verify docs/FEATURES.md (not a git repo yet?)');
}

// ── changelog ─────────────────────────────────────────────────────────────
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
check(changelog.includes(manifest.version), `CHANGELOG.md has an entry for ${manifest.version}`);

// ── report ────────────────────────────────────────────────────────────────
for (const m of ok) console.log(`  ok    ${m}`);
for (const m of warns) console.log(`  warn  ${m}`);
for (const m of fails) console.log(`  FAIL  ${m}`);

console.log(`\n${ok.length} passed, ${warns.length} warnings, ${fails.length} failures`);
if (fails.length) {
  console.log('\nNot ready to release.');
  process.exit(1);
}
console.log('\nRelease checks passed. Remaining manual steps are in .claude/skills/cws-release.');

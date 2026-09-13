/**
 * Registry consistency. No browser, no network — this must always pass and is
 * the first thing CI runs.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

new Function(readFileSync(new URL('../src/lib/registry.js', import.meta.url), 'utf8'))();
const QT = globalThis.QT;

const behavioursSrc = readFileSync(new URL('../src/content/behaviours.js', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'));

test('every feature is well formed', () => {
  const ids = new Set();
  for (const f of QT.REGISTRY) {
    expect(f.id, 'feature without an id').toBeTruthy();
    expect(ids.has(f.id), `duplicate id: ${f.id}`).toBe(false);
    ids.add(f.id);

    expect(f.id, `${f.id}: ids must be snake_case (they are storage keys)`).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(['css', 'js', 'both'], `${f.id}.kind`).toContain(f.kind);
    expect(['low', 'med', 'high'], `${f.id}.risk`).toContain(f.risk);
    expect(['live', 'unverified', 'needs-account'], `${f.id}.verified`).toContain(f.verified);
    expect(QT.GROUPS.map((g) => g.id), `${f.id}.group`).toContain(f.group);
    expect(['home', 'watch', 'search', 'subs', 'channel', 'shorts', 'all'], `${f.id}.pages`).toContain(f.pages);

    expect(f.label, `${f.id} needs a label`).toBeTruthy();
    expect(f.desc, `${f.id} needs a desc`).toBeTruthy();
    expect(f.desc.length, `${f.id}.desc should be one line`).toBeLessThan(220);

    for (const m of ['study', 'music', 'casual']) {
      expect(typeof f.modes?.[m], `${f.id}.modes.${m} must be boolean`).toBe('boolean');
    }
  }
});

test('css features have selectors, js features have handlers', () => {
  for (const f of QT.REGISTRY) {
    if (f.kind === 'css' || f.kind === 'both') {
      expect(Array.isArray(f.sel), `${f.id} needs a sel array`).toBe(true);
      for (const s of f.sel) {
        expect(s.trim(), `${f.id}: selector has stray whitespace`).toBe(s);
        expect(s.includes('{') || s.includes(';'), `${f.id}: "${s}" looks like CSS, not a selector`).toBe(false);
      }
    }
    if (f.kind === 'js' || f.kind === 'both') {
      expect(f.handler, `${f.id} is kind:${f.kind} but declares no handler`).toBeTruthy();
      expect(
        new RegExp(`H\\.${f.handler}\\s*=`).test(behavioursSrc),
        `${f.id} declares handler "${f.handler}" but behaviours.js does not implement it`
      ).toBe(true);
    }
  }
});

test('no orphan handlers in behaviours.js', () => {
  const declared = new Set(QT.jsFeatures.map((f) => f.handler));
  const implemented = [...behavioursSrc.matchAll(/^\s*H\.(\w+)\s*=/gm)].map((m) => m[1]);
  for (const h of implemented) {
    expect(declared.has(h), `behaviours.js implements "${h}" but no registry entry uses it`).toBe(true);
  }
});

test('modes resolve to sane sets', () => {
  for (const m of ['casual', 'music', 'study']) {
    const on = Object.values(QT.defaultsFor(m)).filter(Boolean).length;
    expect(on, `${m} mode turns nothing on`).toBeGreaterThan(5);
    expect(on, `${m} mode turns everything on — that is what Study is for`).toBeLessThanOrEqual(QT.REGISTRY.length);
  }
  expect(Object.values(QT.defaultsFor('off')).some(Boolean), 'Off mode must be fully off').toBe(false);

  const study = QT.defaultsFor('study');
  const casual = QT.defaultsFor('casual');
  expect(
    Object.values(study).filter(Boolean).length,
    'Study should be at least as aggressive as Casual'
  ).toBeGreaterThan(Object.values(casual).filter(Boolean).length);

  // Music mode's whole point (decision D11).
  expect(QT.defaultsFor('music').mixes, 'Music mode must keep mixes').toBe(false);
  expect(QT.defaultsFor('music').playlists_sitewide, 'Music mode must keep playlists').toBe(false);
});

test('manifest stays minimal and correctly ordered', () => {
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions, 'permissions must stay at storage only (decision D5)').toEqual(['storage']);
  expect(manifest.host_permissions).toEqual(['*://*.youtube.com/*']);

  const js = manifest.content_scripts[0].js;
  expect(js[0], 'registry.js must load first — everything reads globalThis.QT').toBe('lib/registry.js');
  expect(js.indexOf('lib/dom.js')).toBeLessThan(js.indexOf('content/behaviours.js'));
  expect(js.indexOf('lib/storage.js')).toBeLessThan(js.indexOf('content/main.js'));
  expect(js.at(-1), 'main.js must load last').toBe('content/main.js');
  expect(manifest.content_scripts[0].run_at, 'must be document_start for the no-flash path').toBe('document_start');
});

test('no network code anywhere in src', () => {
  const files = [
    'lib/registry.js', 'lib/dom.js', 'lib/storage.js',
    'content/css-engine.js', 'content/behaviours.js', 'content/main.js',
    'background/service-worker.js', 'options/options.js', 'popup/popup.js',
  ];
  for (const f of files) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
    expect(
      /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new WebSocket/.test(src),
      `${f} contains network code — the "nothing leaves your browser" claim is a hard constraint`
    ).toBe(false);
  }
});

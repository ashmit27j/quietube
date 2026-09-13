/**
 * Registry consistency, checked across every pack. No browser, no network —
 * this must always pass and is the first thing CI runs.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Add a pack id here when a new one ships — nothing else in this file
// names a specific pack.
const PACK_IDS = ['youtube', 'reddit'];

const coreBehavioursSrc = readFileSync(new URL('../src/core/behaviours.js', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'));

globalThis.chrome = { storage: { sync: { get: async () => ({}), set: async () => {} } } };
new Function(readFileSync(new URL('../src/core/storage.js', import.meta.url), 'utf8'))();
new Function(coreBehavioursSrc)();

const allDeclaredHandlers = new Set();

for (const id of PACK_IDS) {
  const packSrc = readFileSync(new URL(`../src/packs/${id}.js`, import.meta.url), 'utf8');
  new Function(packSrc)();
  const pack = globalThis.QS.pack;
  const handlersSrc = coreBehavioursSrc + '\n' + packSrc;
  for (const f of pack.features) if (f.handler) allDeclaredHandlers.add(f.handler);

  test.describe(`pack: ${id}`, () => {
    test('every feature is well formed', () => {
      const ids = new Set();
      for (const f of pack.features) {
        expect(f.id, 'feature without an id').toBeTruthy();
        expect(ids.has(f.id), `duplicate id: ${f.id}`).toBe(false);
        ids.add(f.id);

        expect(f.id, `${f.id}: ids must be snake_case (they are storage keys)`).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(['css', 'js', 'both'], `${f.id}.kind`).toContain(f.kind);
        expect(['low', 'med', 'high'], `${f.id}.risk`).toContain(f.risk);
        expect(['live', 'unverified', 'needs-account'], `${f.id}.verified`).toContain(f.verified);
        expect(pack.groups.map((g) => g.id), `${f.id}.group`).toContain(f.group);
        expect([...Object.keys(pack.pages), 'all'], `${f.id}.pages`).toContain(f.pages);

        expect(f.label, `${f.id} needs a label`).toBeTruthy();
        expect(f.desc, `${f.id} needs a desc`).toBeTruthy();
        expect(f.desc.length, `${f.id}.desc should be one line`).toBeLessThan(220);

        for (const m of Object.keys(pack.modes)) {
          expect(typeof f.modes?.[m], `${f.id}.modes.${m} must be boolean`).toBe('boolean');
        }
      }
    });

    test('css features have selectors, js features have handlers', () => {
      for (const f of pack.features) {
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
            new RegExp(`H\\.${f.handler}\\s*=`).test(handlersSrc),
            `${f.id} declares handler "${f.handler}" but neither core/behaviours.js nor packs/${id}.js implements it`
          ).toBe(true);
        }
      }
    });

    test('no orphan handlers for this pack', () => {
      const declared = new Set(
        pack.features.filter((f) => f.kind === 'js' || f.kind === 'both').map((f) => f.handler)
      );
      const implementedByPack = [...packSrc.matchAll(/^\s*H\.(\w+)\s*=/gm)].map((m) => m[1]);
      for (const h of implementedByPack) {
        expect(declared.has(h), `packs/${id}.js implements "${h}" but no registry entry uses it`).toBe(true);
      }
    });

    test('modes resolve to sane, distinct sets', () => {
      // Deliberately relative to pack.features.length, not a fixed count —
      // a fixed ">5" floor (this test's first version) assumed a YouTube-sized
      // registry and would demand every single Reddit feature be on in every
      // mode. Exactly the kind of thing step 4 exists to catch.
      const modeNames = Object.keys(pack.modes);
      const resolved = {};
      for (const m of modeNames) {
        const flags = globalThis.QS.storage.defaultsFor(pack, m);
        resolved[m] = flags;
        const on = Object.values(flags).filter(Boolean).length;
        expect(on, `${m} mode turns nothing on`).toBeGreaterThan(0);
        expect(on, `${m} mode turns everything on`).toBeLessThanOrEqual(pack.features.length);
      }
      if (modeNames.length > 1) {
        const distinctSets = new Set(modeNames.map((m) => JSON.stringify(resolved[m])));
        expect(
          distinctSets.size,
          'a pack\'s modes should not all resolve identically — otherwise they are the same mode twice'
        ).toBeGreaterThan(1);
      }
      expect(
        Object.values(globalThis.QS.storage.defaultsFor(pack, 'off')).some(Boolean),
        'Off mode must be fully off'
      ).toBe(false);
    });

    test('manifest declares this pack its own content_scripts entry', () => {
      const entry = manifest.content_scripts.find((cs) => (cs.js || []).some((f) => f === `packs/${id}.js`));
      expect(entry, `no content_scripts entry loads packs/${id}.js`).toBeTruthy();

      const js = entry.js;
      expect(js[0], 'core/dom.js must load first').toBe('core/dom.js');
      expect(js.indexOf('core/storage.js')).toBeLessThan(js.indexOf(`packs/${id}.js`));
      expect(js.indexOf(`packs/${id}.js`)).toBeLessThan(js.indexOf('core/engine.js'));
      expect(js.indexOf('core/engine.js')).toBeLessThan(js.indexOf('core/behaviours.js'));
      expect(js.at(-1), 'core/main.js must load last').toBe('core/main.js');
      expect(entry.run_at, 'must be document_start for the no-flash path').toBe('document_start');
    });
  });
}

test('no orphan handlers in core/behaviours.js', () => {
  const implementedByCore = [...coreBehavioursSrc.matchAll(/^\s*H\.(\w+)\s*=/gm)].map((m) => m[1]);
  for (const h of implementedByCore) {
    expect(allDeclaredHandlers.has(h), `core/behaviours.js implements "${h}" but no pack's registry uses it`).toBe(true);
  }
});

test('manifest stays minimal', () => {
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions, 'permissions must stay at storage only (decision D5)').toEqual(['storage']);
  expect(manifest.host_permissions).toEqual(['*://*.youtube.com/*']);
  expect(/^\d+\.\d+\.\d+$/.test(manifest.version)).toBe(true);
});

test('core is free of any pack\'s selectors or hostnames', () => {
  // 'watch' deliberately excluded from this automated check — it is an
  // ordinary English word ("what did you come here to watch?") as often as
  // it is a YouTube page name, so it stays a CLAUDE.md manual grep rather
  // than a check that would flag its own prose. Distinctive, essentially-
  // never-accidental tokens ('ytd-', 'youtube', whole-word 'shorts',
  // 'reddit', 'shreddit-') don't have that problem — a hit on one of these
  // means either a real leak or a comment that should say "a pack" instead
  // of naming one (see D15's fix in core/dom.js).
  const coreFiles = ['core/dom.js', 'core/storage.js', 'core/engine.js', 'core/behaviours.js', 'core/main.js'];
  const leakRe = /ytd-|youtube|\bshorts\b|reddit|shreddit-/i;
  for (const f of coreFiles) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
    const hit = src.split('\n').map((line, i) => ({ line, i })).find(({ line }) => leakRe.test(line));
    expect(hit, `${f}:${hit?.i + 1} looks like a site-specific leak: "${hit?.line.trim()}"`).toBeUndefined();
  }
});

test('no network code anywhere in src', () => {
  const files = [
    'core/dom.js', 'core/storage.js', 'core/engine.js', 'core/behaviours.js', 'core/main.js',
    ...PACK_IDS.map((id) => `packs/${id}.js`),
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

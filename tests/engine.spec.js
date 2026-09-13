/**
 * CSS engine tests — offline, no network required. Parameterised over every
 * pack (not duplicated per pack), so a new pack gets this coverage for free.
 *
 * Builds a synthetic DOM containing one element per registry selector, runs
 * the REAL pack + core/engine.js against it, and asserts each target is
 * hidden and that page scoping keeps rules off the wrong page types.
 *
 * This tests OUR engine, not a site's live markup. Selector accuracy against
 * the real site is each pack's own live selector test, which needs network
 * (tests/selectors.spec.js for YouTube; see docs/DECISIONS.md D15 for why
 * Reddit doesn't have one yet).
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Add a pack id here when a new one ships.
const PACK_IDS = ['youtube', 'reddit'];

const engineSrc = readFileSync(new URL('../src/core/engine.js', import.meta.url), 'utf8');

/**
 * Build DOM for a selector like `ytd-browse[page-subtype="home"] ytd-rich-grid-renderer`
 * or `ytd-guide-entry-renderer:has(a[title="Shorts"])`.
 * Handles: tag, #id, .class, [attr], [attr="v"], descendant combinators, :has().
 * Returns HTML, or null for a selector shape the builder does not support.
 */
function fixtureFor(selector) {
  const parts = selector.split(/\s+(?![^[]*\])(?![^(]*\))/).filter(Boolean);
  let html = '';
  let close = '';
  for (const part of parts) {
    const has = part.match(/:has\((.+)\)$/);
    const bare = part.replace(/:has\(.+\)$/, '');

    const tag = (bare.match(/^[\w-]+/) || ['div'])[0];
    const id = (bare.match(/#([\w-]+)/) || [])[1];
    const classes = [...bare.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
    // Handles [a], [a="v"], and the substring operators [a^="v"] [a$="v"] [a*="v"]
    const attrs = [...bare.matchAll(/\[([\w-]+)(?:([~^$*|]?)=["']?([^\]"']*)["']?)?\]/g)];

    let open = `<${tag}`;
    if (id) open += ` id="${id}"`;
    if (classes.length) open += ` class="${classes.join(' ')}"`;
    for (const [, k, op, v] of attrs) {
      // Generate a value that actually satisfies the operator, so the fixture
      // matches its own selector (e.g. [href^="/shorts/"] → "/shorts/abc123").
      let val = v ?? '';
      if (op === '^') val = `${v}abc123`;
      else if (op === '$') val = `x${v}`;
      else if (op === '*' || op === '~') val = `x ${v} y`;
      open += ` ${k}="${val}"`;
    }
    open += '>';

    html += open;
    if (has) html += fixtureFor(has[1]) || '';
    close = `</${tag}>` + close;
  }
  return html + close;
}

/**
 * Serve a blank page from the real target origin, fulfilled locally by
 * Playwright — no network is used, and no request escapes the sandbox. This is
 * required because `about:blank` has no localStorage, and the engine's
 * synchronous no-flash path reads localStorage on the page origin.
 */
async function serveOrigin(page, origin) {
  await page.route('**/*', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' })
  );
  await page.goto(origin);
}

async function boot(page, { origin, packSrc, pageType, flags }) {
  await serveOrigin(page, origin);
  await page.evaluate((t) => document.documentElement.setAttribute('data-qs-page', t), pageType);
  await page.addScriptTag({ content: packSrc });
  await page.evaluate((f) => {
    try { localStorage.setItem('qs:flags:v1', JSON.stringify(f)); } catch {}
  }, flags);
  await page.addScriptTag({ content: engineSrc });
}

for (const id of PACK_IDS) {
  const packSrc = readFileSync(new URL(`../src/packs/${id}.js`, import.meta.url), 'utf8');
  new Function(packSrc)();
  const pack = globalThis.QS.pack;
  const origin = pack.hosts[0].replace(/^\*:\/\/\*\./, 'https://www.').replace(/\/\*$/, '/');

  const allOn = () => Object.fromEntries(pack.features.map((f) => [f.id, true]));
  const allOff = () => Object.fromEntries(pack.features.map((f) => [f.id, false]));
  const somePage = Object.keys(pack.pages)[0];

  test.describe(`css engine — pack: ${id}`, () => {
    // `style: true` features change how something looks rather than hiding it,
    // so they are asserted separately below.
    const hideable = pack.features.filter((f) => (f.kind === 'css' || f.kind === 'both') && f.sel?.length && !f.style);

    for (const f of hideable) {
      test(`hides ${f.id} when on`, async ({ page }) => {
        const pageType = f.pages === 'all' ? somePage : f.pages;
        await boot(page, { origin, packSrc, pageType, flags: allOn() });

        const sel = f.sel[0];
        const html = fixtureFor(sel);
        test.skip(!html, `builder cannot construct a fixture for "${sel}"`);

        await page.evaluate((h) => { document.body.insertAdjacentHTML('beforeend', h); }, html);

        const hidden = await page.evaluate((s) => {
          const el = document.querySelector(s);
          if (!el) return 'fixture did not match its own selector';
          return getComputedStyle(el).display === 'none' ? true : getComputedStyle(el).display;
        }, sel);

        expect(hidden, `${f.id}: first selector "${sel}" did not hide the element`).toBe(true);
      });
    }

    test('hides nothing when every flag is off', async ({ page }) => {
      await boot(page, { origin, packSrc, pageType: somePage, flags: allOff() });
      const css = await page.evaluate(() => document.getElementById('qs-style')?.textContent ?? null);
      expect(css, 'a style element should still exist').not.toBeNull();
      expect(css.trim(), 'all-off must generate an empty stylesheet').toBe('');
    });

    test('page scoping keeps one page type\'s rules off another', async ({ page }) => {
      const scoped = pack.features.find((f) => f.pages !== 'all' && f.sel?.length);
      test.skip(!scoped, `pack ${id} has no page-scoped (non-'all') selector feature to check`);
      const otherPage = Object.keys(pack.pages).find((p) => p !== scoped.pages) || 'other';

      await boot(page, { origin, packSrc, pageType: otherPage, flags: allOn() });
      const html = fixtureFor(scoped.sel[0]);
      await page.evaluate((h) => document.body.insertAdjacentHTML('beforeend', h), html);
      const display = await page.evaluate(
        (s) => getComputedStyle(document.querySelector(s)).display,
        scoped.sel[0]
      );
      expect(display, `${scoped.id} is scoped to '${scoped.pages}' but fired on '${otherPage}'`).not.toBe('none');
    });

    test('re-applying with the same flags does not churn the stylesheet', async ({ page }) => {
      await boot(page, { origin, packSrc, pageType: somePage, flags: allOn() });
      const same = await page.evaluate(() => {
        const before = document.getElementById('qs-style').textContent;
        globalThis.QS.css.apply(globalThis.QS.css.readCache());
        return before === document.getElementById('qs-style').textContent;
      });
      expect(same).toBe(true);
    });

    test('survives a corrupt flags cache', async ({ page }) => {
      await serveOrigin(page, origin);
      await page.addScriptTag({ content: packSrc });
      await page.evaluate(() => localStorage.setItem('qs:flags:v1', '{not json'));
      await page.addScriptTag({ content: engineSrc });
      const ok = await page.evaluate(() => globalThis.QS.css.readCache() === null);
      expect(ok, 'a corrupt cache must read as null, not throw').toBe(true);
    });

    test('style:true features never fall through to the generic hide rule', async ({ page }) => {
      const styleFeatures = pack.features.filter((f) => f.style);
      test.skip(!styleFeatures.length, `pack ${id} declares no style:true features`);

      const flags = { ...allOff() };
      for (const f of styleFeatures) flags[f.id] = true;
      await boot(page, { origin, packSrc, pageType: somePage, flags });

      const css = await page.evaluate(() => document.getElementById('qs-style')?.textContent ?? '');
      expect(
        css.length,
        `turning on ${styleFeatures.map((f) => f.id).join(', ')} produced no CSS — buildExtraCss may be missing a case`
      ).toBeGreaterThan(0);
      for (const f of styleFeatures) {
        expect(
          css,
          `${f.id} is style:true but got display:none from the generic hide loop (D12)`
        ).not.toMatch(new RegExp(`/\\*\\s*${f.id}\\s*\\*/[\\s\\S]*?display:\\s*none`));
      }
    });
  });
}

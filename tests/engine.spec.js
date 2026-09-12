/**
 * CSS engine tests — offline, no YouTube required.
 *
 * Builds a synthetic DOM containing one element per registry selector, runs the
 * REAL registry + css-engine against it, and asserts each target is hidden and
 * that page scoping keeps rules off the wrong page types.
 *
 * This tests OUR engine, not YouTube's markup. Selector accuracy against the
 * live site is tests/selectors.spec.js, which needs network and a browser that
 * can reach youtube.com.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const registrySrc = readFileSync(new URL('../src/lib/registry.js', import.meta.url), 'utf8');
const engineSrc = readFileSync(new URL('../src/content/css-engine.js', import.meta.url), 'utf8');

new Function(registrySrc)();
const QT = globalThis.QT;

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
 * Serve a blank page from the real youtube.com origin, fulfilled locally by
 * Playwright — no network is used, and no request escapes the sandbox. This is
 * required because `about:blank` has no localStorage, and the engine's
 * synchronous no-flash path reads localStorage on the page origin.
 */
async function serveOrigin(page) {
  await page.route('**/*', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' })
  );
  await page.goto('https://www.youtube.com/');
}

async function boot(page, { pageType, flags }) {
  await serveOrigin(page);
  await page.evaluate((t) => document.documentElement.setAttribute('data-qt-page', t), pageType);
  await page.addScriptTag({ content: registrySrc });
  await page.evaluate((f) => {
    try { localStorage.setItem('qt:flags:v1', JSON.stringify(f)); } catch {}
  }, flags);
  await page.addScriptTag({ content: engineSrc });
}

const allOn = () => Object.fromEntries(QT.REGISTRY.map((f) => [f.id, true]));
const allOff = () => Object.fromEntries(QT.REGISTRY.map((f) => [f.id, false]));

test.describe('css engine', () => {
  // `style: true` features change how something looks rather than hiding it,
  // so they are asserted separately below.
  const hideable = QT.cssFeatures.filter((f) => f.sel?.length && !f.style);

  for (const f of hideable) {
    test(`hides ${f.id} when on`, async ({ page }) => {
      const pageType = f.pages === 'all' ? 'watch' : f.pages;
      await boot(page, { pageType, flags: allOn() });

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
    await boot(page, { pageType: 'watch', flags: allOff() });
    const css = await page.evaluate(() => document.getElementById('qt-style')?.textContent ?? null);
    expect(css, 'a style element should still exist').not.toBeNull();
    expect(css.trim(), 'all-off must generate an empty stylesheet').toBe('');
  });

  test('page scoping keeps home rules off the watch page', async ({ page }) => {
    const homeOnly = QT.cssFeatures.find((f) => f.pages === 'home' && f.sel?.length);
    await boot(page, { pageType: 'watch', flags: allOn() });
    const html = fixtureFor(homeOnly.sel[0]);
    await page.evaluate((h) => document.body.insertAdjacentHTML('beforeend', h), html);
    const display = await page.evaluate(
      (s) => getComputedStyle(document.querySelector(s)).display,
      homeOnly.sel[0]
    );
    expect(display, `${homeOnly.id} is scoped to home but fired on watch`).not.toBe('none');
  });

  test('re-applying with the same flags does not churn the stylesheet', async ({ page }) => {
    await boot(page, { pageType: 'home', flags: allOn() });
    const same = await page.evaluate(() => {
      const before = document.getElementById('qt-style').textContent;
      globalThis.QT.css.apply(globalThis.QT.css.readCache());
      return before === document.getElementById('qt-style').textContent;
    });
    expect(same).toBe(true);
  });

  test('survives a corrupt flags cache', async ({ page }) => {
    await serveOrigin(page);
    await page.addScriptTag({ content: registrySrc });
    await page.evaluate(() => localStorage.setItem('qt:flags:v1', '{not json'));
    await page.addScriptTag({ content: engineSrc });
    const ok = await page.evaluate(() => globalThis.QT.css.readCache() === null);
    expect(ok, 'a corrupt cache must read as null, not throw').toBe(true);
  });

  test('grayscale applies a filter rather than hiding', async ({ page }) => {
    await boot(page, { pageType: 'home', flags: { ...allOff(), grayscale_thumbs: true } });
    const css = await page.evaluate(() => document.getElementById('qt-style').textContent);
    expect(css).toContain('grayscale(1)');
    expect(css).not.toContain('display: none');
  });
});

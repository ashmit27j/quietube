/**
 * End-to-end: load the real unpacked extension into Chromium and check that
 * it boots and injects on both a youtube.com and a reddit.com page.
 *
 * The page is served locally by Playwright route fulfillment, so this needs no
 * network — but the ORIGIN is real, which is what makes the manifest's
 * content_scripts match fire. This is the strongest check available offline:
 * it validates the manifest, the content script load order, the service
 * worker, the storage round-trip, and (since the Reddit pack) that each
 * pack's content_scripts entry fires only on its own host.
 *
 * Selector accuracy against a site's actual markup is a separate concern —
 * see tests/selectors.spec.js (YouTube; Reddit has none yet, see D15).
 */
import { test, expect, chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = join(ROOT, 'src');

const SHELL = `<!doctype html><html><head><title>YouTube</title></head><body>
  <ytd-app>
    <div id="guide"></div>
    <ytd-browse page-subtype="home"><ytd-rich-grid-renderer>feed</ytd-rich-grid-renderer></ytd-browse>
  </ytd-app>
</body></html>`;

let ctx;
let userDataDir;

test.beforeAll(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'qs-profile-'));
  ctx = await chromium.launchPersistentContext(userDataDir, {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    channel: process.env.PLAYWRIGHT_CHROMIUM_PATH ? undefined : 'chromium',
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  await ctx.route('**/*', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: SHELL })
  );
});

test.afterAll(async () => {
  await ctx?.close();
  if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
});

test('the extension loads without a manifest error', async () => {
  // A manifest Chrome refuses to parse means no service worker is ever
  // registered, so this is the cheapest possible smoke test.
  const page = await ctx.newPage();
  await page.goto('chrome://extensions/');
  const body = await page.evaluate(() => document.body.innerText).catch(() => '');
  expect(body.toLowerCase()).not.toContain('failed to load');
  await page.close();
});

test('content scripts run, and stay invisible to the page', async () => {
  const page = await ctx.newPage();
  await page.goto('https://www.youtube.com/');
  await page.waitForTimeout(800);

  // Content scripts live in an ISOLATED WORLD, so page.evaluate (which runs in
  // the page's main world) cannot see globalThis.QS. That is the correct and
  // desirable behaviour — YouTube's own scripts cannot read or tamper with our
  // state — so we assert the isolation holds, and prove the scripts ran by
  // their effects instead.
  const leaked = await page.evaluate(() => typeof globalThis.QS);
  expect(leaked, 'QS must not be reachable from the page main world').toBe('undefined');

  // Effects visible across the world boundary: the stamp, the stylesheet, and
  // the shared localStorage cache. All three require every content script in
  // the load order to have executed successfully.
  const proof = await page.evaluate(() => ({
    stamp: document.documentElement.getAttribute('data-qs-page'),
    styleEl: !!document.getElementById('qs-style'),
    cache: (() => { try { return !!localStorage.getItem('qs:flags:v1'); } catch { return false; } })(),
  }));

  expect(proof.stamp, 'core/main.js did not run').toBe('home');
  expect(proof.styleEl, 'core/engine.js did not run').toBe(true);
  expect(proof.cache, 'core/storage.js / core/main.js did not complete the reconcile').toBe(true);
  await page.close();
});

test('the page is stamped with its type and a stylesheet is injected', async () => {
  const page = await ctx.newPage();
  await page.goto('https://www.youtube.com/');
  await page.waitForTimeout(800);

  expect(await page.getAttribute('html', 'data-qs-page')).toBe('home');
  const css = await page.evaluate(() => document.getElementById('qs-style')?.textContent ?? null);
  expect(css, 'no stylesheet element was injected').not.toBeNull();
  await page.close();
});

test('the default mode actually hides the home feed', async () => {
  const page = await ctx.newPage();
  await page.goto('https://www.youtube.com/');
  await page.waitForTimeout(800);

  const display = await page.evaluate(
    () => getComputedStyle(document.querySelector('ytd-rich-grid-renderer')).display
  );
  expect(display, 'Casual is the install default and must hide the home grid').toBe('none');
  await page.close();
});

test('the flags cache is written for the next cold load', async () => {
  const page = await ctx.newPage();
  await page.goto('https://www.youtube.com/');
  await page.waitForTimeout(800);

  const cached = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('qs:flags:v1')); } catch { return null; }
  });
  expect(cached, 'without this cache every cold load flashes the feed').not.toBeNull();
  expect(cached.home_feed).toBe(true);
  await page.close();
});

test('the Reddit pack loads on reddit.com', async () => {
  const page = await ctx.newPage();
  await page.goto('https://www.reddit.com/');
  await page.waitForTimeout(800);

  const stamp = await page.evaluate(() => ({
    site: document.documentElement.getAttribute('data-qs-site'),
    styleEl: !!document.getElementById('qs-style'),
  }));
  expect(stamp.site, 'packs/reddit.js did not stamp data-qs-site').toBe('reddit');
  expect(stamp.styleEl, 'core/engine.js did not run on reddit.com').toBe(true);
  await page.close();
});

test('the YouTube pack does not also fire on reddit.com', async () => {
  const page = await ctx.newPage();
  await page.goto('https://www.reddit.com/');
  await page.waitForTimeout(800);

  // The mocked SHELL body is YouTube-shaped markup regardless of which host
  // is requested (route fulfillment doesn't vary by URL). If the YouTube
  // pack's content script matched reddit.com too, its home_feed rule would
  // hide ytd-rich-grid-renderer here. It must not — only packs/reddit.js's
  // own content_scripts entry should match this host (each pack loads only
  // on its own host).
  const display = await page.evaluate(() => {
    const el = document.querySelector('ytd-rich-grid-renderer');
    return el ? getComputedStyle(el).display : 'not-present';
  });
  expect(display, 'the YouTube pack must not run on reddit.com').not.toBe('none');
  await page.close();
});

test('no console errors from our code', async () => {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && /quietsurf|qs-|registry|behaviour/i.test(m.text())) errors.push(m.text());
  });
  await page.goto('https://www.youtube.com/');
  await page.waitForTimeout(1200);
  expect(errors).toEqual([]);
  await page.close();
});

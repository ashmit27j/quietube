/**
 * End-to-end: load the real unpacked extension into Chromium and check that it
 * boots and injects on a youtube.com page.
 *
 * The page is served locally by Playwright route fulfillment, so this needs no
 * network — but the ORIGIN is real youtube.com, which is what makes the
 * manifest's content_scripts match fire. This is the strongest check available
 * offline: it validates the manifest, the content script load order, the
 * service worker, and the storage round-trip in one go.
 *
 * Selector accuracy against YouTube's actual markup is a separate concern —
 * see tests/selectors.spec.js.
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
  userDataDir = mkdtempSync(join(tmpdir(), 'qt-profile-'));
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
  // the page's main world) cannot see globalThis.QT. That is the correct and
  // desirable behaviour — YouTube's own scripts cannot read or tamper with our
  // state — so we assert the isolation holds, and prove the scripts ran by
  // their effects instead.
  const leaked = await page.evaluate(() => typeof globalThis.QT);
  expect(leaked, 'QT must not be reachable from the page main world').toBe('undefined');

  // Effects visible across the world boundary: the stamp, the stylesheet, and
  // the shared localStorage cache. All three require every content script in
  // the load order to have executed successfully.
  const proof = await page.evaluate(() => ({
    stamp: document.documentElement.getAttribute('data-qt-page'),
    styleEl: !!document.getElementById('qt-style'),
    cache: (() => { try { return !!localStorage.getItem('qt:flags:v1'); } catch { return false; } })(),
  }));

  expect(proof.stamp, 'main.js did not run').toBe('home');
  expect(proof.styleEl, 'css-engine.js did not run').toBe(true);
  expect(proof.cache, 'storage.js / main.js did not complete the reconcile').toBe(true);
  await page.close();
});

test('the page is stamped with its type and a stylesheet is injected', async () => {
  const page = await ctx.newPage();
  await page.goto('https://www.youtube.com/');
  await page.waitForTimeout(800);

  expect(await page.getAttribute('html', 'data-qt-page')).toBe('home');
  const css = await page.evaluate(() => document.getElementById('qt-style')?.textContent ?? null);
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
    try { return JSON.parse(localStorage.getItem('qt:flags:v1')); } catch { return null; }
  });
  expect(cached, 'without this cache every cold load flashes the feed').not.toBeNull();
  expect(cached.home_feed).toBe(true);
  await page.close();
});

test('no console errors from our code', async () => {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && /quiet|qt-|registry|behaviour/i.test(m.text())) errors.push(m.text());
  });
  await page.goto('https://www.youtube.com/');
  await page.waitForTimeout(1200);
  expect(errors).toEqual([]);
  await page.close();
});

/**
 * End-to-end: load the real unpacked extension into Chromium and check the
 * things that are only true of the REAL manifest + REAL load mechanism —
 * not testable by feeding source files straight to a page, which is what
 * tests/engine.spec.js does for the CSS engine and page-classification logic
 * itself (those tests are permission-agnostic, since they never go through
 * the extension's actual loading pipeline).
 *
 * Since D16 (optional host permissions), that pipeline's headline property
 * is that NOTHING injects until a host permission is granted — a fresh
 * install must be near-empty. This file's job is mostly to prove that.
 *
 * What this file does NOT and cannot cover: the actual interactive
 * chrome.permissions.request() grant flow. It's a native browser UI surface
 * outside the page DOM; Playwright can dispatch a real, trusted click to
 * *start* the request, but the approve/deny bubble itself cannot be reached
 * from here (confirmed by hand — the request hangs waiting for a human).
 * See docs/DECISIONS.md D16 and tests/permissions.spec.js for what IS
 * covered instead (the registration logic, stubbed and — below — against the
 * real chrome.scripting API).
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
  // Scoped to http(s) only — a bare '**/*' also matches chrome-extension://
  // requests, which would replace popup.html/options.html's own <script src>
  // loads with this HTML body and break them with a "Unexpected token '<'"
  // parse error (found by the step 6 popup/options tests below).
  await ctx.route('https://**/*', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: SHELL })
  );

  // onInstalled opens the options page in its own tab (open_in_tab: true).
  // Left racing with this file's own ctx.newPage() calls, that auto-opened
  // navigation can interrupt an unrelated page's goto() — let it settle and
  // close it before any test starts.
  await getServiceWorker();
  const auto = await ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  if (auto) {
    await auto.waitForLoadState('load').catch(() => {});
    await auto.close().catch(() => {});
  }
});

test.afterAll(async () => {
  await ctx?.close();
  if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
});

async function getServiceWorker() {
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10_000 });
  return sw;
}

test('the extension loads without a manifest error', async () => {
  // A manifest Chrome refuses to parse means no service worker is ever
  // registered, so this is the cheapest possible smoke test.
  const page = await ctx.newPage();
  await page.goto('chrome://extensions/');
  const body = await page.evaluate(() => document.body.innerText).catch(() => '');
  expect(body.toLowerCase()).not.toContain('failed to load');
  await page.close();
});

test('onInstalled seeds schema-2 defaults with zero sites and masterEnabled true', async () => {
  const sw = await getServiceWorker();
  const stored = await sw.evaluate(() => (chrome.storage.sync || chrome.storage.local).get(null));
  expect(stored.schema).toBe(2);
  expect(stored.masterEnabled).toBe(true);
  expect(stored.sites).toEqual({});
});

test('install grants no host permissions — optional_host_permissions stays optional', async () => {
  const sw = await getServiceWorker();
  const granted = await sw.evaluate(() => chrome.permissions.getAll());
  expect(granted.origins, 'a near-empty install must request nothing up front').toEqual([]);
  expect(granted.permissions).toEqual(expect.arrayContaining(['storage', 'scripting']));
});

test('with zero permissions granted, no pack injects on its own host', async () => {
  const yt = await ctx.newPage();
  await yt.goto('https://www.youtube.com/');
  await yt.waitForTimeout(800);
  expect(
    await yt.evaluate(() => document.documentElement.getAttribute('data-qs-page')),
    'the YouTube pack must not run before its host permission is granted'
  ).toBeNull();
  await yt.close();

  const rd = await ctx.newPage();
  await rd.goto('https://www.reddit.com/');
  await rd.waitForTimeout(800);
  expect(
    await rd.evaluate(() => document.documentElement.getAttribute('data-qs-site')),
    'the Reddit pack must not run before its host permission is granted'
  ).toBeNull();
  await rd.close();

  const li = await ctx.newPage();
  await li.goto('https://www.linkedin.com/');
  await li.waitForTimeout(800);
  expect(
    await li.evaluate(() => document.documentElement.getAttribute('data-qs-site')),
    'the LinkedIn pack must not run before its host permission is granted'
  ).toBeNull();
  await li.close();
});

test('pack-scripts.js registers and unregisters against the real chrome.scripting API', async () => {
  const sw = await getServiceWorker();

  expect(await sw.evaluate(() => chrome.scripting.getRegisteredContentScripts())).toEqual([]);

  await sw.evaluate(() => registerPackScripts('youtube'));
  const afterRegister = await sw.evaluate(() => chrome.scripting.getRegisteredContentScripts());
  expect(afterRegister.map((r) => r.id)).toEqual(['youtube']);
  expect(afterRegister[0].matches).toEqual(['*://*.youtube.com/*']);

  // Registering without an actual granted host permission must not cause
  // injection — that's the whole property this permission model relies on.
  const page = await ctx.newPage();
  await page.goto('https://www.youtube.com/');
  await page.waitForTimeout(800);
  expect(
    await page.evaluate(() => document.documentElement.getAttribute('data-qs-page')),
    'registerContentScripts alone (no grant) must not be enough to inject'
  ).toBeNull();
  await page.close();

  await sw.evaluate(() => unregisterPackScripts('youtube'));
  expect(await sw.evaluate(() => chrome.scripting.getRegisteredContentScripts())).toEqual([]);
});

test('no console errors from the service worker', async () => {
  const sw = await getServiceWorker();
  const errors = [];
  sw.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await sw.evaluate(() => syncRegisteredScripts());
  await new Promise((r) => setTimeout(r, 300));
  expect(errors).toEqual([]);
});

test.describe('popup and options pages (step 6 progressive disclosure)', () => {
  async function extensionUrl(path) {
    const sw = await getServiceWorker();
    return `chrome-extension://${new URL(sw.url()).host}/${path}`;
  }

  test('options page renders a card per known pack, with no console errors', async () => {
    const errors = [];
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(await extensionUrl('options/options.html'));
    await page.waitForTimeout(600);

    expect(await page.locator('.site-card').count(), 'one card per known pack').toBe(3);
    expect(await page.locator('#master-toggle').isChecked()).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  });

  test('footer links to GitHub and every site card shows a logo badge', async () => {
    const page = await ctx.newPage();
    await page.goto(await extensionUrl('options/options.html'));
    await page.waitForTimeout(600);

    const githubLink = page.locator('.foot a[href*="github.com"]');
    await expect(githubLink).toHaveCount(1);
    expect(await page.locator('.site-card .site-logo').count()).toBe(3);
    await page.close();
  });

  test('site cards start collapsed and expand on the arrow click', async () => {
    const page = await ctx.newPage();
    await page.goto(await extensionUrl('options/options.html'));
    await page.waitForTimeout(600);

    const firstCard = page.locator('.site-card').first();
    await expect(firstCard.locator('.groups')).toBeHidden();
    await expect(firstCard.locator('.modes'), 'the mode picker must stay visible while collapsed').toBeVisible();

    await firstCard.locator('.expand-btn').click();
    await page.waitForTimeout(200);
    await expect(firstCard.locator('.groups')).toBeVisible();
    await expect(firstCard.locator('.expand-btn')).toHaveAttribute('aria-expanded', 'true');
    await page.close();
  });

  test('picking Off on a site needs no permission and updates its mode button', async () => {
    const page = await ctx.newPage();
    await page.goto(await extensionUrl('options/options.html'));
    await page.waitForTimeout(600);

    const youtubeCard = page.locator('.site-card').first();
    await youtubeCard.locator('.modes button', { hasText: 'Off' }).click();
    await page.waitForTimeout(300);
    await expect(youtubeCard.locator('.modes button', { hasText: 'Off' })).toHaveAttribute('aria-checked', 'true');
    await page.close();
  });

  test('the quick-star toggle adds and removes a feature from sites[id].quick', async () => {
    const page = await ctx.newPage();
    await page.goto(await extensionUrl('options/options.html'));
    await page.waitForTimeout(600);

    // Site cards collapse their toggle list by default — expand the first
    // one before the quick-star (inside it) can be interacted with.
    await page.locator('.expand-btn').first().click();
    await page.waitForTimeout(200);

    const star = page.locator('.quick-star').first();
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await star.click();
    await page.waitForTimeout(300);
    await expect(star).toHaveAttribute('aria-pressed', 'true');

    const sw = await getServiceWorker();
    const stored = await sw.evaluate(() => (chrome.storage.sync || chrome.storage.local).get(null));
    expect(stored.sites.youtube.quick).toContain('home_feed'); // first feature in the first group
    await page.close();
  });

  test('popup renders without console errors regardless of which site is detected', async () => {
    // This environment cannot make chrome.tabs.query reveal a real tab URL
    // from the popup (activeTab only activates on a genuine action-icon
    // invocation, which opening popup.html as a plain tab is not — see
    // docs/DECISIONS.md D16's addendum) — so this only exercises the
    // "no pack detected" fallback path, not the per-site view. It still
    // proves the popup boots cleanly against the real multi-pack storage.
    const errors = [];
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(await extensionUrl('popup/popup.html'));
    await page.waitForTimeout(600);

    expect(await page.locator('#master-toggle').count()).toBe(1);
    expect(await page.locator('#unsupported-view').isHidden()).toBe(false);
    expect(await page.locator('#request-pack').getAttribute('href')).toContain('github.com');
    expect(errors).toEqual([]);
    await page.close();
  });
});

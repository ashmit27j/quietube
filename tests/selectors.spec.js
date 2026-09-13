/**
 * Selector health check.
 *
 * Loads real YouTube pages and asserts that every registry selector still
 * matches at least one node. This is the early-warning system for YouTube
 * redesigns — see .claude/skills/yt-selector-audit.
 *
 * Run: npx playwright test tests/selectors.spec.js --reporter=list
 *
 * Notes:
 *  - Chromium is preinstalled in this environment at /opt/pw-browsers/chromium.
 *    Do NOT run `playwright install`.
 *  - Signed-out YouTube covers everything except the subscriptions feed.
 *    Those cases are skipped rather than deleted so the gap stays visible.
 *  - A `risk: 'high'` failure is routine maintenance. A `risk: 'low'` failure
 *    means a real redesign and probably several other things are broken too.
 *  - Features whose registry `verified` is `unverified` or `needs-account`
 *    are skipped, not asserted: a signed-out, history-less, never-served-an-ad
 *    session structurally cannot confirm them either way (see D14). Reporting
 *    them as failures is what makes an audit nobody trusts.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

new Function(readFileSync(new URL('../src/lib/registry.js', import.meta.url), 'utf8'))();
const { REGISTRY } = globalThis.QT;

const PAGES = {
  home:    'https://www.youtube.com/',
  watch:   'https://www.youtube.com/watch?v=aqz-KE-bpKQ',  // Big Buck Bunny, stable public video
  search:  'https://www.youtube.com/results?search_query=lofi',
  channel: 'https://www.youtube.com/@YouTube/videos',
  subs:    'https://www.youtube.com/feed/subscriptions',   // requires a session
  shorts:  'https://www.youtube.com/shorts/',
};

const NEEDS_AUTH = new Set(['subs']);

for (const [page, url] of Object.entries(PAGES)) {
  const features = REGISTRY.filter(
    (f) => f.sel && f.sel.length && (f.pages === page || f.pages === 'all')
  );
  if (!features.length) continue;

  test.describe(`selectors on /${page}`, () => {
    test.skip(NEEDS_AUTH.has(page), 'needs a signed-in session');

    for (const f of features) {
      // `unverified` / `needs-account` features are known-unconfirmable from
      // this signed-out, history-less session (D14) — skipping rather than
      // failing them is the whole point of the `verified` field: an audit
      // that reports false failures is an audit nobody runs.
      const title = `${f.id} (risk:${f.risk}, verified:${f.verified})`;
      if (f.verified !== 'live') {
        test.skip(title, () => {});
        continue;
      }
      test(title, async ({ page: p }) => {
        await p.goto(url, { waitUntil: 'domcontentloaded' });
        // YouTube hydrates lazily; give the renderers a moment.
        await p.waitForTimeout(3500);

        // The suggestions container does not exist until the user types —
        // it is not a page-load element, so simulate the interaction.
        if (f.id === 'search_suggestions') {
          const box = p.locator('input[name="search_query"]').first();
          if (await box.count()) {
            await box.click();
            await box.type('a', { delay: 50 });
            await p.waitForTimeout(1000);
          }
        }

        // The watch page starts with the guide drawer collapsed, so guide
        // entries do not exist in the DOM until it is opened. Open it only
        // when it is not already populated (other page types render it open
        // by default, and re-clicking would toggle it shut).
        if (f.id === 'shorts_nav') {
          const guideOpen = await p.evaluate(
            () => document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer').length > 0
          );
          if (!guideOpen) {
            const guideBtn = p.locator('button[aria-label="Guide"]').first();
            if (await guideBtn.count()) {
              await guideBtn.click().catch(() => {});
              await p.waitForTimeout(1500);
            }
          }
        }

        const counts = {};
        for (const sel of f.sel) {
          counts[sel] = await p.evaluate((s) => {
            try { return document.querySelectorAll(s).length; } catch { return -1; }
          }, sel);
        }
        const total = Object.values(counts).filter((n) => n > 0).reduce((a, b) => a + b, 0);

        expect(
          total,
          `No selector for "${f.id}" matched on /${page}. Counts: ${JSON.stringify(counts)}\n` +
            `(-1 means the selector is invalid CSS in this browser — :has() needs Chrome 105+.)`
        ).toBeGreaterThan(0);
      });
    }
  });
}

test('registry is internally consistent', () => {
  const ids = new Set();
  for (const f of REGISTRY) {
    expect(f.id, 'every feature needs an id').toBeTruthy();
    expect(ids.has(f.id), `duplicate id: ${f.id}`).toBe(false);
    ids.add(f.id);
    expect(['css', 'js', 'both']).toContain(f.kind);
    expect(['low', 'med', 'high']).toContain(f.risk);
    expect(['live', 'unverified', 'needs-account']).toContain(f.verified);
    expect(f.modes, `${f.id} missing mode defaults`).toBeTruthy();
    for (const m of ['study', 'music', 'casual']) {
      expect(typeof f.modes[m], `${f.id}.modes.${m} must be a boolean`).toBe('boolean');
    }
    if (f.kind === 'js' || f.kind === 'both') {
      expect(f.handler, `${f.id} is kind:${f.kind} but declares no handler`).toBeTruthy();
    }
    if (f.kind === 'css') {
      expect(Array.isArray(f.sel), `${f.id} is kind:css and needs a sel array`).toBe(true);
    }
  }
});

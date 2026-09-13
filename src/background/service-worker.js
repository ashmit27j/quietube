/**
 * Service worker. Deliberately tiny.
 *
 * MV3 service workers are killed aggressively, so nothing stateful lives here.
 * It exists only for the two things a content script cannot do:
 *   - respond to keyboard commands registered in the manifest
 *   - seed defaults on install
 *
 * Unlike core/ and packs/, this file cannot load a pack to ask it anything —
 * service workers and content scripts are separate execution contexts with no
 * shared globalThis. It duplicates the schema-2 shape from core/storage.js
 * (pre-existing: it never shared code with storage.js even in the single-site
 * version) and hardcodes SITE_ID because a global keyboard shortcut has no
 * per-site concept without the `tabs` permission (see docs/DECISIONS.md D5) —
 * genuinely multi-site keyboard commands are a later problem.
 */

const SITE_ID = 'youtube';
const MODE_CYCLE = ['off', 'casual', 'music', 'study'];
const PEEK_MS = 30_000;

const area = () => chrome.storage.sync || chrome.storage.local;

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await area().set({
      schema: 2,
      masterEnabled: true,
      sites: {
        [SITE_ID]: { mode: 'casual', custom: {}, overrides: {}, quick: [] },
      },
      schedule: { enabled: false, rules: [] },
      peekUntil: 0,
    });
    chrome.runtime.openOptionsPage();
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const cur = await area().get(['sites', 'peekUntil']);
  const site = cur.sites?.[SITE_ID] || { mode: 'casual', custom: {}, overrides: {}, quick: [] };

  if (command === 'cycle-mode') {
    const i = MODE_CYCLE.indexOf(site.mode || 'casual');
    const next = MODE_CYCLE[(i + 1) % MODE_CYCLE.length];
    await area().set({
      sites: { ...cur.sites, [SITE_ID]: { ...site, mode: next } },
      peekUntil: 0,
    });
    return;
  }

  if (command === 'peek') {
    // Toggle: a second press ends the peek early.
    const active = (cur.peekUntil || 0) > Date.now();
    await area().set({ peekUntil: active ? 0 : Date.now() + PEEK_MS });
  }
});

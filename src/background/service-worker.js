/**
 * Service worker. Deliberately tiny.
 *
 * MV3 service workers are killed aggressively, so nothing stateful lives here.
 * It exists for:
 *   - respond to keyboard commands registered in the manifest
 *   - seed defaults on install
 *   - keep registered content scripts (pack-scripts.js) in sync with
 *     whichever optional host permissions are currently granted (D16)
 *
 * Unlike core/ and packs/, this file cannot load a pack to ask it anything —
 * service workers and content scripts are separate execution contexts with no
 * shared globalThis. It duplicates the schema-2 shape from core/storage.js
 * (pre-existing: it never shared code with storage.js even in the single-site
 * version) and hardcodes SITE_ID for the keyboard shortcut, because a global
 * shortcut has no per-site concept without the `tabs` permission (D5) —
 * genuinely multi-site keyboard commands are a later problem.
 */
importScripts('pack-scripts.js');

const SITE_ID = 'youtube';
const MODE_CYCLE = ['off', 'casual', 'music', 'study'];
const PEEK_MS = 30_000;

const area = () => chrome.storage.sync || chrome.storage.local;

// Registration must be re-synced on every cold start of the service worker,
// not just on install: registered content scripts persist across sessions,
// but this worker's job is to make sure they still match whatever the user
// has actually granted, in case anything drifted (an uninstalled pack, a
// permission revoked from chrome://extensions, etc).
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await area().set({
      schema: 2,
      masterEnabled: true,
      sites: {},
      schedule: { enabled: false, rules: [] },
      peekUntil: 0,
    });
    chrome.runtime.openOptionsPage();
  }
  await syncRegisteredScripts();
});

chrome.runtime.onStartup.addListener(() => {
  syncRegisteredScripts();
});

// A grant or removal can come from the popup's "enable this site" flow, or
// from the user managing permissions directly in chrome://extensions — sync
// either way, and inject into the active tab immediately on a fresh grant so
// the user doesn't have to manually refresh the page they were looking at.
chrome.permissions.onAdded.addListener(async (perms) => {
  await syncRegisteredScripts();
  for (const pack of QS_PACKS) {
    if ((perms.origins || []).some((o) => pack.matches.includes(o))) {
      await injectIntoActiveTab(pack.id);
    }
  }
});

chrome.permissions.onRemoved.addListener(() => {
  syncRegisteredScripts();
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

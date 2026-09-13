/**
 * Which content script + CSS files belong to each pack, and how to
 * register/unregister them against whatever optional host permissions are
 * currently granted.
 *
 * A classic script (no ESM, no build step) so the service worker
 * (`importScripts`) and the popup (`<script src>`) can share it without
 * duplicating the file list. This is the one place that knows both "a pack"
 * and "which files make it up" — everything else (core/, packs/*.js) stays
 * unaware that permissions are even a thing.
 *
 * D16: this is what costs the `scripting` permission. With zero host
 * permissions granted at install, a static `content_scripts` manifest entry
 * would just never fire — Chrome does not (re)inject a manifest-declared
 * content script into pages on a host that gains its permission mid-session
 * without a full browser restart. `chrome.scripting.registerContentScripts`
 * is the dynamic equivalent that reacts immediately to a fresh grant.
 */
const QS_PACKS = [
  {
    id: 'youtube',
    matches: ['*://*.youtube.com/*'],
    css: ['packs/youtube.css'],
    js: [
      'core/dom.js',
      'core/storage.js',
      'packs/youtube.js',
      'core/engine.js',
      'core/behaviours.js',
      'core/main.js',
    ],
  },
  {
    id: 'reddit',
    matches: ['*://*.reddit.com/*'],
    css: ['packs/reddit.css'],
    js: [
      'core/dom.js',
      'core/storage.js',
      'packs/reddit.js',
      'core/engine.js',
      'core/behaviours.js',
      'core/main.js',
    ],
  },
  {
    id: 'linkedin',
    matches: ['*://*.linkedin.com/*'],
    css: ['packs/linkedin.css'],
    js: [
      'core/dom.js',
      'core/storage.js',
      'packs/linkedin.js',
      'core/engine.js',
      'core/behaviours.js',
      'core/main.js',
    ],
  },
];

function packEntry(pack) {
  return {
    id: pack.id,
    matches: pack.matches,
    css: pack.css,
    js: pack.js,
    runAt: 'document_start',
    persistAcrossSessions: true,
  };
}

/** Register (or update, if already registered) one pack's content script. */
async function registerPackScripts(packId) {
  const pack = QS_PACKS.find((p) => p.id === packId);
  if (!pack) return;
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [pack.id] });
  if (existing.length) {
    await chrome.scripting.updateContentScripts([packEntry(pack)]);
  } else {
    await chrome.scripting.registerContentScripts([packEntry(pack)]);
  }
}

async function unregisterPackScripts(packId) {
  await chrome.scripting.unregisterContentScripts({ ids: [packId] }).catch(() => {});
}

/**
 * Bring registered scripts in line with currently-granted host permissions.
 * Call this on install, on browser startup, and after any permission grant
 * or removal — registration does not persist a promise to stay in sync on
 * its own.
 */
async function syncRegisteredScripts() {
  const granted = await chrome.permissions.getAll();
  const grantedOrigins = new Set(granted.origins || []);
  for (const pack of QS_PACKS) {
    const hasGrant = pack.matches.every((m) => grantedOrigins.has(m));
    if (hasGrant) await registerPackScripts(pack.id);
    else await unregisterPackScripts(pack.id);
  }
}

/**
 * Inject a just-granted pack into the current tab immediately, so the user
 * does not have to manually refresh the page they were looking at when they
 * enabled it. Best-effort: if the active tab isn't on this pack's host, or
 * anything about the injection fails, this quietly does nothing — the
 * content script will still run on the next navigation regardless.
 */
async function injectIntoActiveTab(packId) {
  const pack = QS_PACKS.find((p) => p.id === packId);
  if (!pack) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return;
    const onHost = pack.matches.some((m) => matchPattern(m, tab.url));
    if (!onHost) return;
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: pack.css });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: pack.js });
  } catch {
    /* best-effort only — see doc comment */
  }
}

/** Minimal `*://*.host.com/*`-shaped match-pattern test, no library needed. */
function matchPattern(pattern, url) {
  const re = new RegExp(
    '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
  );
  return re.test(url);
}

// Top-level function declarations in a classic script are already callable
// by bare name from the service worker's own code and from an attached
// `evaluate()` — this explicit namespace exists only so the popup (a
// separate page, clearer to read as `QSBackground.x`) and the offline test
// harness (which evaluates this file's source in an isolated function scope,
// where bare names don't survive) can reach the same functions.
globalThis.QSBackground = {
  QS_PACKS, registerPackScripts, unregisterPackScripts, syncRegisteredScripts, injectIntoActiveTab, matchPattern,
};

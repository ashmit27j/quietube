/**
 * background/pack-scripts.js — the logic behind the optional-permission
 * model (D16). Pure logic, chrome.scripting/chrome.permissions/chrome.tabs
 * all stubbed, no browser.
 *
 * What this file deliberately does NOT test: the actual interactive
 * chrome.permissions.request() grant flow, or whether a real browser
 * injects a script into a page after a real grant. Both were checked by
 * hand against a real, unpacked-loaded Chromium during development —
 * registering a pack's content script without a granted host permission
 * succeeds (no error) but does not inject anything, which is exactly the
 * "near-empty install does nothing" property this model is for — but the
 * grant UI itself is a native browser surface outside the page's DOM
 * (confirmed by dispatching a real, trusted click into
 * chrome.permissions.request() and observing it hang waiting for a human).
 * No CI-safe way to automate that exists, so it isn't claimed here. See
 * docs/DECISIONS.md D16.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const STATE = { registered: [], grantedOrigins: [], activeTab: null };
const calls = { register: [], update: [], unregister: [], executeScript: [], insertCSS: [] };

function resetState() {
  STATE.registered = [];
  STATE.grantedOrigins = [];
  STATE.activeTab = null;
  calls.register = [];
  calls.update = [];
  calls.unregister = [];
  calls.executeScript = [];
  calls.insertCSS = [];
}

globalThis.chrome = {
  scripting: {
    getRegisteredContentScripts: async ({ ids }) =>
      STATE.registered.filter((r) => ids.includes(r.id)),
    registerContentScripts: async (entries) => {
      calls.register.push(entries);
      STATE.registered.push(...entries);
    },
    updateContentScripts: async (entries) => {
      calls.update.push(entries);
      for (const e of entries) {
        const i = STATE.registered.findIndex((r) => r.id === e.id);
        if (i >= 0) STATE.registered[i] = e;
      }
    },
    unregisterContentScripts: async ({ ids }) => {
      calls.unregister.push(ids);
      STATE.registered = STATE.registered.filter((r) => !ids.includes(r.id));
    },
    executeScript: async (opts) => { calls.executeScript.push(opts); },
    insertCSS: async (opts) => { calls.insertCSS.push(opts); },
  },
  permissions: {
    getAll: async () => ({ origins: STATE.grantedOrigins, permissions: ['storage', 'scripting'] }),
  },
  tabs: {
    query: async () => (STATE.activeTab ? [STATE.activeTab] : []),
  },
};

new Function(readFileSync(new URL('../src/background/pack-scripts.js', import.meta.url), 'utf8'))();
const { registerPackScripts, unregisterPackScripts, syncRegisteredScripts, injectIntoActiveTab, matchPattern } =
  globalThis.QSBackground;

test.beforeEach(resetState);

// tests/registry.spec.js checks that QS_PACKS agrees with each pack's own
// `hosts` and load order; this file is only about pack-scripts.js's own
// register/unregister/sync logic.

test('registerPackScripts registers a pack that isn\'t registered yet', async () => {
  await registerPackScripts('youtube');
  expect(calls.register.length).toBe(1);
  expect(calls.update.length).toBe(0);
  expect(STATE.registered.map((r) => r.id)).toEqual(['youtube']);
  expect(STATE.registered[0].matches).toEqual(['*://*.youtube.com/*']);
  expect(STATE.registered[0].runAt).toBe('document_start');
});

test('registerPackScripts updates rather than re-registers an already-registered pack', async () => {
  await registerPackScripts('youtube');
  await registerPackScripts('youtube');
  expect(calls.register.length, 'the second call must not register again').toBe(1);
  expect(calls.update.length).toBe(1);
  expect(STATE.registered.length, 'still exactly one registration for this pack').toBe(1);
});

test('unregisterPackScripts is a no-op, not a throw, when nothing was registered', async () => {
  await expect(unregisterPackScripts('youtube')).resolves.toBeUndefined();
});

test('syncRegisteredScripts registers only fully-granted packs and unregisters the rest', async () => {
  STATE.grantedOrigins = ['*://*.youtube.com/*'];
  await syncRegisteredScripts();
  expect(STATE.registered.map((r) => r.id)).toEqual(['youtube']);

  // Now revoke and grant the other way, and confirm it follows.
  STATE.grantedOrigins = ['*://*.reddit.com/*'];
  await syncRegisteredScripts();
  expect(STATE.registered.map((r) => r.id)).toEqual(['reddit']);
});

test('syncRegisteredScripts with nothing granted registers nothing', async () => {
  await registerPackScripts('youtube'); // simulate a stale registration from a prior grant
  STATE.grantedOrigins = [];
  await syncRegisteredScripts();
  expect(STATE.registered).toEqual([]);
});

test('injectIntoActiveTab only injects when the active tab is on that pack\'s host', async () => {
  STATE.activeTab = { id: 7, url: 'https://www.youtube.com/watch?v=abc' };
  await injectIntoActiveTab('youtube');
  expect(calls.executeScript.length).toBe(1);
  expect(calls.executeScript[0].target).toEqual({ tabId: 7 });
  expect(calls.insertCSS.length).toBe(1);

  resetState();
  STATE.activeTab = { id: 7, url: 'https://www.reddit.com/' };
  await injectIntoActiveTab('youtube');
  expect(calls.executeScript.length, 'must not inject the youtube pack into a reddit.com tab').toBe(0);
});

test('injectIntoActiveTab does nothing, not throw, with no active tab', async () => {
  STATE.activeTab = null;
  await expect(injectIntoActiveTab('youtube')).resolves.toBeUndefined();
  expect(calls.executeScript.length).toBe(0);
});

test.describe('matchPattern', () => {
  test('matches a wildcard-subdomain host pattern', () => {
    expect(matchPattern('*://*.youtube.com/*', 'https://www.youtube.com/watch?v=x')).toBe(true);
    expect(matchPattern('*://*.youtube.com/*', 'http://m.youtube.com/')).toBe(true);
  });

  test('does not match a different host', () => {
    expect(matchPattern('*://*.youtube.com/*', 'https://www.reddit.com/')).toBe(false);
  });
});

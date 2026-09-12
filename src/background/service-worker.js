/**
 * Service worker. Deliberately tiny.
 *
 * MV3 service workers are killed aggressively, so nothing stateful lives here.
 * It exists only for the two things a content script cannot do:
 *   - respond to keyboard commands registered in the manifest
 *   - seed defaults on install
 */

const MODE_CYCLE = ['off', 'casual', 'music', 'study'];
const PEEK_MS = 30_000;

const area = () => chrome.storage.sync || chrome.storage.local;

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await area().set({
      schema: 1,
      mode: 'casual',
      custom: {},
      overrides: {},
      schedule: { enabled: false, rules: [] },
      peekUntil: 0,
      placeholderText: 'What did you come here to watch?',
    });
    chrome.runtime.openOptionsPage();
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const cur = await area().get(['mode', 'peekUntil']);

  if (command === 'cycle-mode') {
    const i = MODE_CYCLE.indexOf(cur.mode || 'casual');
    const next = MODE_CYCLE[(i + 1) % MODE_CYCLE.length];
    await area().set({ mode: next, peekUntil: 0 });
    return;
  }

  if (command === 'peek') {
    // Toggle: a second press ends the peek early.
    const active = (cur.peekUntil || 0) > Date.now();
    await area().set({ peekUntil: active ? 0 : Date.now() + PEEK_MS });
  }
});

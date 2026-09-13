/**
 * Mode / override / peek / schedule resolution, and the schema-2 site
 * nesting + kill switch. Pure logic, no browser.
 *
 * This is the layer that decides what is actually hidden, so it deserves the
 * most tests in the project.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// storage.js calls chrome.storage at module scope only inside functions, but
// `area()` is evaluated lazily — stub just enough for it to load.
globalThis.chrome = { storage: { sync: { get: async () => ({}), set: async () => {} } } };
new Function(readFileSync(new URL('../src/core/storage.js', import.meta.url), 'utf8'))();
new Function(readFileSync(new URL('../src/packs/youtube.js', import.meta.url), 'utf8'))();

const QS = globalThis.QS;
const pack = QS.pack;

/** A fresh schema-2 config with this pack's site already seeded. */
const base = () => {
  const cfg = structuredClone(QS.storage.DEFAULTS);
  cfg.sites[pack.id] = QS.storage.siteDefaults(pack);
  return cfg;
};

/** `base()` with the site's mode set, plus any other site-level overrides. */
const withMode = (mode, siteExtra = {}) => {
  const cfg = base();
  Object.assign(cfg.sites[pack.id], siteExtra, { mode });
  return cfg;
};

test('off mode hides nothing', () => {
  const { flags } = QS.storage.resolve(withMode('off'));
  expect(Object.values(flags).some(Boolean)).toBe(false);
});

test('deep_focus is stricter than light', () => {
  const count = (mode) =>
    Object.values(QS.storage.resolve(withMode(mode)).flags).filter(Boolean).length;
  expect(count('deep_focus')).toBeGreaterThan(count('light'));
});

test('overrides beat the mode in both directions', () => {
  const cfg = withMode('deep_focus', { overrides: { home_feed: false, view_count: true } });
  const { flags } = QS.storage.resolve(cfg);
  expect(flags.home_feed, 'override should turn a mode-on feature off').toBe(false);
  expect(flags.view_count, 'override should turn a mode-off feature on').toBe(true);
  expect(flags.watch_sidebar, 'untouched features keep the mode default').toBe(true);
});

test('peek reveals everything and only while it lasts', () => {
  const now = Date.now();
  const cfg = withMode('deep_focus');
  cfg.peekUntil = now + 10_000;
  expect(Object.values(QS.storage.resolve(cfg, now).flags).some(Boolean)).toBe(false);
  expect(
    Object.values(QS.storage.resolve(cfg, now + 20_000).flags).some(Boolean),
    'an expired peek must stop revealing'
  ).toBe(true);
});

test('peek beats an override that is explicitly on', () => {
  const now = Date.now();
  const cfg = withMode('light', { overrides: { comments_hide: true } });
  cfg.peekUntil = now + 5000;
  expect(QS.storage.resolve(cfg, now).flags.comments_hide).toBe(false);
});

test('custom mode starts from light and applies the custom set', () => {
  const cfg = withMode('custom', { custom: { view_count: true, home_feed: false } });
  const { flags } = QS.storage.resolve(cfg);
  expect(flags.view_count).toBe(true);
  expect(flags.home_feed).toBe(false);
  expect(flags.watch_sidebar, 'unspecified keys fall back to the light baseline').toBe(true);
});

test.describe('mode aliases (D17: casual/study renamed to light/deep_focus)', () => {
  test('a site stored under the old mode name resolves exactly like the new one', () => {
    const legacy = QS.storage.resolve(withMode('casual'));
    const current = QS.storage.resolve(withMode('light'));
    expect(legacy.flags).toEqual(current.flags);
  });

  test('activeMode reports the current name, not the stored legacy one', () => {
    expect(QS.storage.activeMode(withMode('study'))).toBe('deep_focus');
    expect(QS.storage.activeMode(withMode('casual'))).toBe('light');
  });

  test('a schedule rule written under the old mode name still resolves', () => {
    const cfg = withMode('light');
    cfg.schedule = { enabled: true, rules: [{ days: [1, 2, 3, 4, 5], from: '00:00', to: '23:59', mode: 'study' }] };
    const monday10 = new Date(2026, 8, 14, 10, 0).getTime();
    expect(QS.storage.activeMode(cfg, monday10)).toBe('deep_focus');
  });
});

test.describe('master kill switch', () => {
  test('masterEnabled: false hides everything regardless of mode', () => {
    const cfg = withMode('deep_focus');
    cfg.masterEnabled = false;
    const { mode, flags } = QS.storage.resolve(cfg);
    expect(mode).toBe('off');
    expect(Object.values(flags).some(Boolean)).toBe(false);
  });

  test('masterEnabled beats overrides and an active peek too', () => {
    const cfg = withMode('deep_focus', { overrides: { home_feed: true } });
    cfg.masterEnabled = false;
    cfg.peekUntil = Date.now() + 999_999;
    const { flags } = QS.storage.resolve(cfg);
    expect(Object.values(flags).some(Boolean), 'masterEnabled must be checked before anything else').toBe(false);
  });

  test('masterEnabled: true (the default) does not affect resolution', () => {
    const cfg = withMode('deep_focus');
    expect(QS.storage.resolve(cfg).mode).toBe('deep_focus');
  });
});

test.describe('schedule', () => {
  const withRule = (rule) => {
    const cfg = withMode('light');
    cfg.schedule = { enabled: true, rules: [rule] };
    return cfg;
  };
  // Monday 2026-09-14 at 10:00 local
  const monday10 = new Date(2026, 8, 14, 10, 0).getTime();
  const monday20 = new Date(2026, 8, 14, 20, 0).getTime();
  const sunday10 = new Date(2026, 8, 13, 10, 0).getTime();

  test('a matching weekday window wins over the manual mode', () => {
    const cfg = withRule({ days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00', mode: 'deep_focus' });
    expect(QS.storage.activeMode(cfg, monday10)).toBe('deep_focus');
    expect(QS.storage.activeMode(cfg, monday20)).toBe('light');
    expect(QS.storage.activeMode(cfg, sunday10)).toBe('light');
  });

  test('a window that crosses midnight still matches', () => {
    const cfg = withRule({ days: [1], from: '22:00', to: '06:00', mode: 'deep_focus' });
    const monday23 = new Date(2026, 8, 14, 23, 0).getTime();
    const monday2am = new Date(2026, 8, 14, 2, 0).getTime();
    const monday12 = new Date(2026, 8, 14, 12, 0).getTime();
    expect(QS.storage.activeMode(cfg, monday23)).toBe('deep_focus');
    expect(QS.storage.activeMode(cfg, monday2am)).toBe('deep_focus');
    expect(QS.storage.activeMode(cfg, monday12)).toBe('light');
  });

  test('a disabled schedule is ignored', () => {
    const cfg = withRule({ days: [1], from: '09:00', to: '17:00', mode: 'deep_focus' });
    cfg.schedule.enabled = false;
    expect(QS.storage.activeMode(cfg, monday10)).toBe('light');
  });

  test('the boundary is inclusive at the start, exclusive at the end', () => {
    const cfg = withRule({ days: [1], from: '09:00', to: '17:00', mode: 'deep_focus' });
    expect(QS.storage.activeMode(cfg, new Date(2026, 8, 14, 9, 0).getTime())).toBe('deep_focus');
    expect(QS.storage.activeMode(cfg, new Date(2026, 8, 14, 17, 0).getTime())).toBe('light');
  });

  test('the first matching rule wins', () => {
    const cfg = withMode('light');
    cfg.schedule = {
      enabled: true,
      rules: [
        { days: [1], from: '09:00', to: '17:00', mode: 'deep_focus' },
        { days: [1], from: '10:00', to: '11:00', mode: 'music' },
      ],
    };
    expect(QS.storage.activeMode(cfg, monday10)).toBe('deep_focus');
  });
});

test.describe('schema 1 -> 2 migration', () => {
  const originalGet = globalThis.chrome.storage.sync.get;
  test.afterEach(() => { globalThis.chrome.storage.sync.get = originalGet; });

  test('wraps a legacy flat config under sites[pack.id] and adds the kill switch', async () => {
    globalThis.chrome.storage.sync.get = async () => ({
      schema: 1,
      mode: 'study',
      custom: { view_count: true },
      overrides: { home_feed: false },
      schedule: { enabled: false, rules: [] },
      peekUntil: 0,
    });

    const cfg = await QS.storage.load();
    expect(cfg.schema).toBe(2);
    expect(cfg.masterEnabled, 'migration must not disable the extension').toBe(true);
    expect(cfg.sites[pack.id]).toEqual({
      mode: 'study',
      custom: { view_count: true },
      overrides: { home_feed: false },
      quick: [],
    });
    expect(cfg.mode, 'the flat legacy key must not survive migration').toBeUndefined();
    expect(cfg.custom).toBeUndefined();
    expect(cfg.overrides).toBeUndefined();
  });

  test('an already-schema-2 config with no site yet gets seeded, not overwritten', async () => {
    globalThis.chrome.storage.sync.get = async () => ({
      schema: 2,
      masterEnabled: false,
      sites: {},
      schedule: { enabled: false, rules: [] },
      peekUntil: 0,
    });

    const cfg = await QS.storage.load();
    expect(cfg.masterEnabled, 'migration must not touch an explicit false').toBe(false);
    expect(cfg.sites[pack.id]).toEqual(QS.storage.siteDefaults(pack));
  });

  test('a missing schema is treated as schema 1', async () => {
    globalThis.chrome.storage.sync.get = async () => ({ mode: 'casual' });
    const cfg = await QS.storage.load();
    expect(cfg.schema).toBe(2);
    expect(cfg.sites[pack.id].mode).toBe('casual');
  });
});

test.describe('multi-pack contexts (popup/options load more than one pack)', () => {
  // Other spec files share this worker process and also do `new
  // Function(readFileSync(...packs/reddit.js))()` at their own top level, so
  // globalThis.QS.packs may already hold both packs by the time this file's
  // tests run — reset to a known single-pack baseline before each test
  // rather than assuming a pristine one, and restore it after the last.
  test.beforeEach(() => {
    globalThis.QS.pack = pack;
    globalThis.QS.packs = { [pack.id]: pack };
  });
  test.afterAll(() => {
    globalThis.QS.pack = pack;
    globalThis.QS.packs = { [pack.id]: pack };
  });

  function loadReddit() {
    new Function(readFileSync(new URL('../src/packs/reddit.js', import.meta.url), 'utf8'))();
    return globalThis.QS.packs.reddit;
  }

  test('knownPacks() returns every loaded pack once a second one is loaded', () => {
    expect(Object.keys(globalThis.QS.packs)).toEqual([pack.id]); // just youtube, per beforeEach
    loadReddit();
    const known = QS.storage.knownPacks();
    expect(known.map((p) => p.id).sort()).toEqual(['reddit', 'youtube']);
  });

  test('load() seeds a site for every known pack, not just the last-loaded one', async () => {
    loadReddit();
    globalThis.chrome.storage.sync.get = async () => ({});
    const cfg = await QS.storage.load();
    expect(Object.keys(cfg.sites).sort()).toEqual(['reddit', 'youtube']);
    expect(cfg.sites.youtube).toEqual(QS.storage.siteDefaults(globalThis.QS.packs.youtube));
    expect(cfg.sites.reddit).toEqual(QS.storage.siteDefaults(globalThis.QS.packs.reddit));
  });

  test('resolve()/activeMode() accept an explicit pack, for a page with several loaded', () => {
    const redditPack = loadReddit();
    const cfg = base();
    cfg.sites.reddit = { mode: 'deep_focus', custom: {}, overrides: {}, quick: [] };
    expect(QS.storage.activeMode(cfg, Date.now(), redditPack)).toBe('deep_focus');
    const { flags } = QS.storage.resolve(cfg, Date.now(), redditPack);
    expect(flags.right_sidebar, 'reddit deep_focus should hide the right sidebar').toBe(true);
    expect(typeof flags.promoted_posts, 'these must be reddit\'s flags, not youtube\'s').toBe('boolean');
    expect(flags.home_feed, 'a youtube-only feature id should not appear in reddit\'s flags').toBeUndefined();
  });
});

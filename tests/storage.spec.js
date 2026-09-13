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

test('study is stricter than casual', () => {
  const count = (mode) =>
    Object.values(QS.storage.resolve(withMode(mode)).flags).filter(Boolean).length;
  expect(count('study')).toBeGreaterThan(count('casual'));
});

test('overrides beat the mode in both directions', () => {
  const cfg = withMode('study', { overrides: { home_feed: false, view_count: true } });
  const { flags } = QS.storage.resolve(cfg);
  expect(flags.home_feed, 'override should turn a mode-on feature off').toBe(false);
  expect(flags.view_count, 'override should turn a mode-off feature on').toBe(true);
  expect(flags.watch_sidebar, 'untouched features keep the mode default').toBe(true);
});

test('peek reveals everything and only while it lasts', () => {
  const now = Date.now();
  const cfg = withMode('study');
  cfg.peekUntil = now + 10_000;
  expect(Object.values(QS.storage.resolve(cfg, now).flags).some(Boolean)).toBe(false);
  expect(
    Object.values(QS.storage.resolve(cfg, now + 20_000).flags).some(Boolean),
    'an expired peek must stop revealing'
  ).toBe(true);
});

test('peek beats an override that is explicitly on', () => {
  const now = Date.now();
  const cfg = withMode('casual', { overrides: { comments_hide: true } });
  cfg.peekUntil = now + 5000;
  expect(QS.storage.resolve(cfg, now).flags.comments_hide).toBe(false);
});

test('custom mode starts from casual and applies the custom set', () => {
  const cfg = withMode('custom', { custom: { view_count: true, home_feed: false } });
  const { flags } = QS.storage.resolve(cfg);
  expect(flags.view_count).toBe(true);
  expect(flags.home_feed).toBe(false);
  expect(flags.watch_sidebar, 'unspecified keys fall back to the casual baseline').toBe(true);
});

test.describe('master kill switch', () => {
  test('masterEnabled: false hides everything regardless of mode', () => {
    const cfg = withMode('study');
    cfg.masterEnabled = false;
    const { mode, flags } = QS.storage.resolve(cfg);
    expect(mode).toBe('off');
    expect(Object.values(flags).some(Boolean)).toBe(false);
  });

  test('masterEnabled beats overrides and an active peek too', () => {
    const cfg = withMode('study', { overrides: { home_feed: true } });
    cfg.masterEnabled = false;
    cfg.peekUntil = Date.now() + 999_999;
    const { flags } = QS.storage.resolve(cfg);
    expect(Object.values(flags).some(Boolean), 'masterEnabled must be checked before anything else').toBe(false);
  });

  test('masterEnabled: true (the default) does not affect resolution', () => {
    const cfg = withMode('study');
    expect(QS.storage.resolve(cfg).mode).toBe('study');
  });
});

test.describe('schedule', () => {
  const withRule = (rule) => {
    const cfg = withMode('casual');
    cfg.schedule = { enabled: true, rules: [rule] };
    return cfg;
  };
  // Monday 2026-09-14 at 10:00 local
  const monday10 = new Date(2026, 8, 14, 10, 0).getTime();
  const monday20 = new Date(2026, 8, 14, 20, 0).getTime();
  const sunday10 = new Date(2026, 8, 13, 10, 0).getTime();

  test('a matching weekday window wins over the manual mode', () => {
    const cfg = withRule({ days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00', mode: 'study' });
    expect(QS.storage.activeMode(cfg, monday10)).toBe('study');
    expect(QS.storage.activeMode(cfg, monday20)).toBe('casual');
    expect(QS.storage.activeMode(cfg, sunday10)).toBe('casual');
  });

  test('a window that crosses midnight still matches', () => {
    const cfg = withRule({ days: [1], from: '22:00', to: '06:00', mode: 'study' });
    const monday23 = new Date(2026, 8, 14, 23, 0).getTime();
    const monday2am = new Date(2026, 8, 14, 2, 0).getTime();
    const monday12 = new Date(2026, 8, 14, 12, 0).getTime();
    expect(QS.storage.activeMode(cfg, monday23)).toBe('study');
    expect(QS.storage.activeMode(cfg, monday2am)).toBe('study');
    expect(QS.storage.activeMode(cfg, monday12)).toBe('casual');
  });

  test('a disabled schedule is ignored', () => {
    const cfg = withRule({ days: [1], from: '09:00', to: '17:00', mode: 'study' });
    cfg.schedule.enabled = false;
    expect(QS.storage.activeMode(cfg, monday10)).toBe('casual');
  });

  test('the boundary is inclusive at the start, exclusive at the end', () => {
    const cfg = withRule({ days: [1], from: '09:00', to: '17:00', mode: 'study' });
    expect(QS.storage.activeMode(cfg, new Date(2026, 8, 14, 9, 0).getTime())).toBe('study');
    expect(QS.storage.activeMode(cfg, new Date(2026, 8, 14, 17, 0).getTime())).toBe('casual');
  });

  test('the first matching rule wins', () => {
    const cfg = withMode('casual');
    cfg.schedule = {
      enabled: true,
      rules: [
        { days: [1], from: '09:00', to: '17:00', mode: 'study' },
        { days: [1], from: '10:00', to: '11:00', mode: 'music' },
      ],
    };
    expect(QS.storage.activeMode(cfg, monday10)).toBe('study');
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

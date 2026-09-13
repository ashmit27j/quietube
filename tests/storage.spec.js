/**
 * Mode / override / peek / schedule resolution. Pure logic, no browser.
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
const base = () => structuredClone(QS.storage.DEFAULTS);

test('off mode hides nothing', () => {
  const cfg = { ...base(), mode: 'off' };
  const { flags } = QS.storage.resolve(cfg);
  expect(Object.values(flags).some(Boolean)).toBe(false);
});

test('study is stricter than casual', () => {
  const count = (mode) =>
    Object.values(QS.storage.resolve({ ...base(), mode }).flags).filter(Boolean).length;
  expect(count('study')).toBeGreaterThan(count('casual'));
});

test('overrides beat the mode in both directions', () => {
  const cfg = { ...base(), mode: 'study', overrides: { home_feed: false, view_count: true } };
  const { flags } = QS.storage.resolve(cfg);
  expect(flags.home_feed, 'override should turn a mode-on feature off').toBe(false);
  expect(flags.view_count, 'override should turn a mode-off feature on').toBe(true);
  expect(flags.watch_sidebar, 'untouched features keep the mode default').toBe(true);
});

test('peek reveals everything and only while it lasts', () => {
  const now = Date.now();
  const cfg = { ...base(), mode: 'study', peekUntil: now + 10_000 };
  expect(Object.values(QS.storage.resolve(cfg, now).flags).some(Boolean)).toBe(false);
  expect(
    Object.values(QS.storage.resolve(cfg, now + 20_000).flags).some(Boolean),
    'an expired peek must stop revealing'
  ).toBe(true);
});

test('peek beats an override that is explicitly on', () => {
  const now = Date.now();
  const cfg = { ...base(), mode: 'casual', overrides: { comments_hide: true }, peekUntil: now + 5000 };
  expect(QS.storage.resolve(cfg, now).flags.comments_hide).toBe(false);
});

test('custom mode starts from casual and applies the custom set', () => {
  const cfg = { ...base(), mode: 'custom', custom: { view_count: true, home_feed: false } };
  const { flags } = QS.storage.resolve(cfg);
  expect(flags.view_count).toBe(true);
  expect(flags.home_feed).toBe(false);
  expect(flags.watch_sidebar, 'unspecified keys fall back to the casual baseline').toBe(true);
});

test.describe('schedule', () => {
  const withRule = (rule) => ({
    ...base(),
    mode: 'casual',
    schedule: { enabled: true, rules: [rule] },
  });
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
    const cfg = {
      ...base(),
      mode: 'casual',
      schedule: {
        enabled: true,
        rules: [
          { days: [1], from: '09:00', to: '17:00', mode: 'study' },
          { days: [1], from: '10:00', to: '11:00', mode: 'music' },
        ],
      },
    };
    expect(QS.storage.activeMode(cfg, monday10)).toBe('study');
  });
});

test('migrate stamps a schema on legacy configs', () => {
  const flags = QS.storage.resolve({ ...base(), schema: undefined, mode: 'casual' });
  expect(flags.mode).toBe('casual');
});

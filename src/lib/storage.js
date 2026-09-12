/**
 * Storage layer. One shape, one place.
 *
 * Stored shape (chrome.storage.sync):
 * {
 *   schema: 1,
 *   mode: 'off' | 'casual' | 'music' | 'study' | 'custom',
 *   custom: { [featureId]: boolean },   // only used when mode === 'custom'
 *   overrides: { [featureId]: boolean },// per-feature overrides layered on ANY mode
 *   schedule: { enabled, rules: [{ days:[0-6], from:'HH:MM', to:'HH:MM', mode }] },
 *   peekUntil: 0,                       // epoch ms; while > now, everything is revealed
 *   placeholderText: ''                 // shown where the home feed was
 * }
 *
 * Why sync and not local: settings follow the user across machines for free,
 * and the payload is tiny (well under the 8KB-per-item quota). Fall back to
 * local automatically if sync is unavailable (some enterprise profiles).
 */
(function () {
  const SCHEMA = 1;

  const DEFAULTS = {
    schema: SCHEMA,
    mode: 'casual',
    custom: {},
    overrides: {},
    schedule: { enabled: false, rules: [] },
    peekUntil: 0,
    placeholderText: 'What did you come here to watch?',
  };

  const area = () => (chrome.storage.sync || chrome.storage.local);

  async function load() {
    const raw = await area().get(null);
    const cfg = Object.assign({}, DEFAULTS, raw || {});
    return migrate(cfg);
  }

  function migrate(cfg) {
    // Add a branch per schema bump. Never silently drop unknown keys.
    if (!cfg.schema || cfg.schema < 1) cfg.schema = SCHEMA;
    return cfg;
  }

  async function save(patch) {
    await area().set(patch);
  }

  /**
   * Resolve the effective on/off map for right now.
   * Layering order (later wins): mode defaults → custom set → per-feature overrides → peek.
   */
  function resolve(cfg, now = Date.now()) {
    const mode = activeMode(cfg, now);
    let flags =
      mode === 'custom'
        ? Object.assign(globalThis.QT.defaultsFor('casual'), cfg.custom)
        : globalThis.QT.defaultsFor(mode);
    flags = Object.assign(flags, cfg.overrides || {});
    if (cfg.peekUntil && cfg.peekUntil > now) {
      for (const k of Object.keys(flags)) flags[k] = false;
    }
    return { mode, flags };
  }

  /** Scheduled modes beat the manual mode while a rule window is open. */
  function activeMode(cfg, now = Date.now()) {
    const s = cfg.schedule;
    if (!s || !s.enabled || !Array.isArray(s.rules)) return cfg.mode;
    const d = new Date(now);
    const day = d.getDay();
    const mins = d.getHours() * 60 + d.getMinutes();
    for (const r of s.rules) {
      if (!r.days || !r.days.includes(day)) continue;
      const [fh, fm] = String(r.from).split(':').map(Number);
      const [th, tm] = String(r.to).split(':').map(Number);
      const from = fh * 60 + fm;
      const to = th * 60 + tm;
      const inWindow = from <= to ? mins >= from && mins < to : mins >= from || mins < to;
      if (inWindow) return r.mode;
    }
    return cfg.mode;
  }

  globalThis.QT = Object.assign(globalThis.QT || {}, {
    storage: { SCHEMA, DEFAULTS, load, save, resolve, activeMode },
  });
})();

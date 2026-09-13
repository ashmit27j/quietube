/**
 * Storage layer. One shape, one place. Site-agnostic: it knows nothing about
 * any particular site, and reads the active pack only through the generic
 * surface every pack publishes (`pack.features`, `pack.customBaseMode`) —
 * never a hardcoded mode or feature id.
 *
 * Stored shape (chrome.storage.sync):
 * {
 *   schema: 1,
 *   mode: 'off' | <pack mode name> | 'custom',
 *   custom: { [featureId]: boolean },   // only used when mode === 'custom'
 *   overrides: { [featureId]: boolean },// per-feature overrides layered on ANY mode
 *   schedule: { enabled, rules: [{ days:[0-6], from:'HH:MM', to:'HH:MM', mode }] },
 *   peekUntil: 0,                       // epoch ms; while > now, everything is revealed
 *   placeholderText: ''                 // shown where a hidden feed was, if the pack uses it
 * }
 *
 * This is schema 1 — a single site's worth of settings at the top level.
 * Schema 2 (multi-site) replaces this shape entirely; see docs/DECISIONS.md.
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

  // 'off' and 'custom' are core concepts every pack gets for free — a pack
  // only ever declares its own modes on top of those two.
  const OFF_META = { label: 'Off', blurb: 'Extension does nothing on this site.' };
  const CUSTOM_META = { label: 'Custom', blurb: 'Your own set of toggles.' };

  const area = () => (chrome.storage.sync || chrome.storage.local);

  /** Every feature's on/off default for one mode, from the pack's own data. */
  function defaultsFor(pack, mode) {
    const out = {};
    for (const f of pack.features) out[f.id] = mode === 'off' ? false : !!(f.modes && f.modes[mode]);
    return out;
  }

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
   *
   * `custom` starts from the active pack's declared `customBaseMode` (the
   * pack's own baseline, not a name this file knows) rather than "off", so
   * flipping one switch from a preset doesn't blank out everything else.
   */
  function resolve(cfg, now = Date.now()) {
    const mode = activeMode(cfg, now);
    const pack = globalThis.QS.pack;
    let flags =
      mode === 'custom'
        ? Object.assign(defaultsFor(pack, pack.customBaseMode), cfg.custom)
        : defaultsFor(pack, mode);
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

  globalThis.QS = Object.assign(globalThis.QS || {}, {
    storage: { SCHEMA, DEFAULTS, OFF_META, CUSTOM_META, load, save, resolve, activeMode, defaultsFor },
  });
})();

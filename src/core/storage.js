/**
 * Storage layer. One shape, one place. Site-agnostic: it knows nothing about
 * any particular site, and reads the active pack only through the generic
 * surface every pack publishes (`pack.id`, `pack.features`,
 * `pack.customBaseMode`) — never a hardcoded site key, mode or feature id.
 *
 * Stored shape (chrome.storage.sync), schema 2:
 * {
 *   schema: 2,
 *   masterEnabled: true,                 // false short-circuits every site, checked first
 *   sites: {
 *     [pack.id]: {
 *       mode: 'off' | <pack mode name> | 'custom',
 *       custom: { [featureId]: boolean },    // only used when mode === 'custom'
 *       overrides: { [featureId]: boolean }, // per-feature overrides layered on ANY mode
 *     },
 *   },
 *   schedule: { enabled, rules: [{ days:[0-6], from:'HH:MM', to:'HH:MM', mode }] },
 *   peekUntil: 0,                         // epoch ms; while > now, everything is revealed
 * }
 *
 * `sites` keys itself by whatever `pack.id` the active pack declares — this
 * file never names one. A new pack shows up in the popup/options with no
 * storage.js change: `siteDefaults()` seeds it the first time it's loaded.
 *
 * Why sync and not local: settings follow the user across machines for free,
 * and the payload is tiny (well under the 8KB-per-item quota). Fall back to
 * local automatically if sync is unavailable (some enterprise profiles).
 */
(function () {
  const SCHEMA = 2;

  const DEFAULTS = {
    schema: SCHEMA,
    masterEnabled: true,
    sites: {},
    schedule: { enabled: false, rules: [] },
    peekUntil: 0,
  };

  // 'off' and 'custom' are core concepts every pack gets for free — a pack
  // only ever declares its own modes on top of those two.
  const OFF_META = { label: 'Off', blurb: 'Extension does nothing on this site.' };
  const CUSTOM_META = { label: 'Custom', blurb: 'Your own set of toggles.' };

  const area = () => (chrome.storage.sync || chrome.storage.local);

  /** A freshly-seen site's settings: its own baseline mode, nothing overridden yet. */
  function siteDefaults(pack) {
    return { mode: pack.customBaseMode, custom: {}, overrides: {} };
  }

  /** Every feature's on/off default for one mode, from the pack's own data. */
  function defaultsFor(pack, mode) {
    const out = {};
    for (const f of pack.features) out[f.id] = mode === 'off' ? false : !!(f.modes && f.modes[mode]);
    return out;
  }

  /**
   * Every pack loaded into this context. Content scripts only ever load one
   * pack, so `QS.packs` there holds exactly that one; popup/options pages
   * load every pack they know about (there's no way around this being a
   * static list per page — see docs/ARCHITECTURE.md "Adding a pack"), so
   * `QS.packs` there is the whole set. Either way this file never special-
   * cases which context it's in.
   */
  function knownPacks() {
    return globalThis.QS.packs ? Object.values(globalThis.QS.packs) : [globalThis.QS.pack];
  }

  async function load() {
    const raw = (await area().get(null)) || {};
    // structuredClone, not a shallow Object.assign({}, DEFAULTS, raw): DEFAULTS'
    // nested `sites`/`schedule` objects would otherwise be shared by reference
    // with every cfg that doesn't supply its own, and migrate() writes into
    // `cfg.sites` — a shallow copy would mutate DEFAULTS itself, permanently,
    // the first time a config with no `sites` key was ever loaded.
    const cfg = Object.assign(structuredClone(DEFAULTS), raw);
    // Preserve whether `raw` actually HAD a schema, rather than letting the
    // DEFAULTS merge silently fill in the current one — migrate() needs to
    // tell "genuinely already current" apart from "never had a schema at all".
    cfg.schema = raw.schema;
    const migrated = migrate(cfg);

    migrated.sites = migrated.sites || {};
    for (const pack of knownPacks()) {
      if (!migrated.sites[pack.id]) migrated.sites[pack.id] = siteDefaults(pack);
    }
    return migrated;
  }

  /**
   * schema 1 was a single site's settings flattened at the top level. Wrap
   * them under `sites[pack.id]` and add the kill switch. ~10 lines because
   * that really is the whole migration — schema 1 never had more than one
   * site's worth of state to move.
   */
  function migrate(cfg) {
    if (!cfg.schema || cfg.schema < 2) {
      // Schema 1 predates multi-site entirely — there is only ever one site's
      // worth of legacy data, and it belongs to whichever pack was original,
      // which by convention is always the first one listed on any page that
      // loads more than one pack — see docs/ARCHITECTURE.md "Adding a pack".
      const pack = knownPacks()[0];
      cfg.sites = cfg.sites || {};
      if (!cfg.sites[pack.id]) {
        cfg.sites[pack.id] = {
          mode: cfg.mode || pack.customBaseMode,
          custom: cfg.custom || {},
          overrides: cfg.overrides || {},
        };
      }
      delete cfg.mode;
      delete cfg.custom;
      delete cfg.overrides;
      delete cfg.placeholderText; // was never user-editable; the pack hardcodes its own default now
      if (cfg.masterEnabled === undefined) cfg.masterEnabled = true;
      cfg.schema = SCHEMA;
    }
    return cfg;
  }

  async function save(patch) {
    await area().set(patch);
  }

  /**
   * Resolve the effective on/off map for right now.
   * Layering order (later wins): masterEnabled → site mode defaults → site
   * custom set → site overrides → peek. masterEnabled is checked before
   * anything else — a site being off is not the same as the extension being
   * off everywhere.
   *
   * `custom` starts from the active pack's declared `customBaseMode` (the
   * pack's own baseline, not a name this file knows) rather than "off", so
   * flipping one switch from a preset doesn't blank out everything else.
   *
   * `pack` defaults to `globalThis.QS.pack` — the only pack in a content
   * script's context — so every existing call site stays untouched. A page
   * that has more than one pack loaded (the popup, the options page) passes
   * the specific pack it wants resolved explicitly.
   */
  function resolve(cfg, now = Date.now(), pack = globalThis.QS.pack) {
    if (cfg.masterEnabled === false) {
      return { mode: 'off', flags: defaultsFor(pack, 'off') };
    }

    const mode = activeMode(cfg, now, pack);
    const site = cfg.sites?.[pack.id] || siteDefaults(pack);
    let flags =
      mode === 'custom'
        ? Object.assign(defaultsFor(pack, pack.customBaseMode), site.custom)
        : defaultsFor(pack, mode);
    flags = Object.assign(flags, site.overrides || {});
    if (cfg.peekUntil && cfg.peekUntil > now) {
      for (const k of Object.keys(flags)) flags[k] = false;
    }
    return { mode, flags };
  }

  /**
   * Scheduled modes beat the manual mode while a rule window is open.
   * `pack` defaults the same way `resolve()`'s does — see its doc comment.
   */
  function activeMode(cfg, now = Date.now(), pack = globalThis.QS.pack) {
    const site = cfg.sites?.[pack.id] || siteDefaults(pack);
    // A pack can rename one of its own modes (pack.modeAliases) without
    // breaking a config saved under the old name — remap transparently
    // rather than making every reader of a stored mode string know about it.
    const alias = (m) => (pack.modeAliases && pack.modeAliases[m]) || m;
    const s = cfg.schedule;
    if (!s || !s.enabled || !Array.isArray(s.rules)) return alias(site.mode);
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
      if (inWindow) return alias(r.mode);
    }
    return alias(site.mode);
  }

  globalThis.QS = Object.assign(globalThis.QS || {}, {
    storage: {
      SCHEMA, DEFAULTS, OFF_META, CUSTOM_META,
      siteDefaults, knownPacks, load, save, resolve, activeMode, defaultsFor,
    },
  });
})();

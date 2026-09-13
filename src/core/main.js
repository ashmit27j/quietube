/**
 * ORCHESTRATOR. Generic across every pack — it reads `globalThis.QS.pack`
 * (set by the site pack that loads before this file) for page classification,
 * feature list and handlers, and never names a site itself.
 *
 * Responsibilities, in order:
 *   1. classify the current page (via the pack's own page predicates) and
 *      stamp <html data-qs-page data-qs-site>
 *   2. run the synchronous CSS path (already fired in core/engine.js)
 *   3. load real settings, reconcile the cache, re-apply
 *   4. run/teardown behaviour handlers (core + pack, merged)
 *   5. re-do 1 + 4 on every SPA navigation
 *   6. react live to settings changes from the popup/options page
 *
 * Deliberately has no MutationObserver over the whole document. CSS does the
 * hiding; observing the DOM tree of a heavy SPA is how extensions become slow.
 */
(function () {
  const QS = globalThis.QS;
  const pack = QS.pack;
  // Core handlers first so a pack could (in principle) override one by name;
  // no pack does today.
  const handlers = Object.assign({}, QS.behaviours, pack.handlers);

  let cfg = null;
  let flags = {};
  let cleanups = [];

  /** Ask the pack's own page predicates which page type this URL is. */
  function classify() {
    const url = new URL(location.href);
    for (const [name, test] of Object.entries(pack.pages)) {
      try {
        if (test(url)) return name;
      } catch (e) {
        console.warn(`[QuietSurf] pack "${pack.id}" page test "${name}" threw`, e);
      }
    }
    return 'other';
  }

  function stampPage() {
    const page = classify();
    document.documentElement.setAttribute('data-qs-page', page);
    document.documentElement.setAttribute('data-qs-site', pack.id);
    return page;
  }

  function teardown() {
    for (const fn of cleanups) {
      try { fn(); } catch (e) { /* a handler that throws must not block the rest */ }
    }
    cleanups = [];
  }

  function runBehaviours(page) {
    teardown();
    const ctx = { page, flags, cfg };
    for (const f of pack.features) {
      if (f.kind !== 'js' && f.kind !== 'both') continue;
      if (!flags[f.id]) continue;
      if (f.pages !== 'all' && f.pages !== page) continue;
      const fn = handlers[f.handler];
      if (typeof fn !== 'function') {
        console.warn(`[QuietSurf] registry declares handler "${f.handler}" for ${f.id}, but it is not implemented`);
        continue;
      }
      try {
        const cleanup = fn(ctx);
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      } catch (e) {
        console.warn(`[QuietSurf] handler ${f.handler} failed`, e);
      }
    }
  }

  async function refresh() {
    cfg = await QS.storage.load();
    const resolved = QS.storage.resolve(cfg);
    flags = resolved.flags;
    QS.css.writeCache(flags);   // keep the no-flash cache honest
    QS.css.apply(flags);
    runBehaviours(stampPage());
  }

  // ── boot ────────────────────────────────────────────────────────────────
  stampPage();
  refresh();

  // ── SPA navigation ──────────────────────────────────────────────────────
  function onNavigate() {
    const page = stampPage();
    QS.css.apply(flags);
    runBehaviours(page);
  }

  // A pack may name its own site's SPA-router event(s) for an instant
  // reaction — purely an optimisation, never required, since the href poll
  // below always catches up.
  for (const evt of pack.navEvents || []) {
    document.addEventListener(evt, onNavigate);
  }

  // Some flows change the URL without firing any such event.
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      onNavigate();
    }
  }, 800);

  // ── live settings updates ───────────────────────────────────────────────
  chrome.storage.onChanged.addListener(() => refresh());

  // ── peek expiry ─────────────────────────────────────────────────────────
  // While a peek is active, re-resolve once it lapses so the page re-hides
  // itself without the user touching anything.
  setInterval(() => {
    if (cfg && cfg.peekUntil && cfg.peekUntil <= Date.now()) {
      cfg.peekUntil = 0;
      refresh();
    }
  }, 5000);
})();

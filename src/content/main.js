/**
 * ORCHESTRATOR.
 *
 * Responsibilities, in order:
 *   1. classify the current page and stamp <html data-qt-page>
 *   2. run the synchronous CSS path (already fired in css-engine.js)
 *   3. load real settings, reconcile the cache, re-apply
 *   4. run/teardown behaviour handlers
 *   5. re-do 1 + 4 on every SPA navigation
 *   6. react live to settings changes from the popup/options page
 *
 * Deliberately has no MutationObserver over the whole document. CSS does the
 * hiding; observing the DOM tree of YouTube is how extensions become slow.
 */
(function () {
  const QT = globalThis.QT;
  let cfg = null;
  let flags = {};
  let cleanups = [];

  function classify() {
    const p = location.pathname;
    if (p === '/' || p === '') return 'home';
    if (p.startsWith('/watch')) return 'watch';
    if (p.startsWith('/shorts')) return 'shorts';
    if (p.startsWith('/results')) return 'search';
    if (p.startsWith('/feed/subscriptions')) return 'subs';
    if (p.startsWith('/@') || p.startsWith('/channel/') || p.startsWith('/c/')) return 'channel';
    return 'other';
  }

  function stampPage() {
    const page = classify();
    document.documentElement.setAttribute('data-qt-page', page);
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
    for (const f of QT.jsFeatures) {
      if (!flags[f.id]) continue;
      if (f.pages !== 'all' && f.pages !== page) continue;
      const fn = QT.behaviours[f.handler];
      if (typeof fn !== 'function') {
        console.warn(`[Quiet] registry declares handler "${f.handler}" for ${f.id}, but it is not implemented`);
        continue;
      }
      try {
        const cleanup = fn(ctx);
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      } catch (e) {
        console.warn(`[Quiet] handler ${f.handler} failed`, e);
      }
    }
  }

  async function refresh() {
    cfg = await QT.storage.load();
    const resolved = QT.storage.resolve(cfg);
    flags = resolved.flags;
    QT.css.writeCache(flags);   // keep the no-flash cache honest
    QT.css.apply(flags);
    runBehaviours(stampPage());
  }

  // ── boot ────────────────────────────────────────────────────────────────
  stampPage();
  refresh();

  // ── SPA navigation ──────────────────────────────────────────────────────
  // yt-navigate-finish is YouTube's own signal and is far cheaper than
  // polling location.href or observing the document.
  document.addEventListener('yt-navigate-finish', () => {
    const page = stampPage();
    QT.css.apply(flags);
    runBehaviours(page);
  });

  // Some flows (Shorts → watch) change the URL without firing the event.
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      const page = stampPage();
      QT.css.apply(flags);
      runBehaviours(page);
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

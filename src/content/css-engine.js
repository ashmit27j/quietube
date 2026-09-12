/**
 * CSS ENGINE — why this file exists and why it is shaped like this.
 *
 * PROBLEM 1: flash of unwanted content.
 *   chrome.storage is async. A content script at document_start that awaits
 *   storage before injecting CSS will always paint one frame of the full
 *   YouTube homepage first. Every competitor has this flicker. It is the most
 *   common complaint in their reviews.
 *
 *   FIX: mirror the resolved flags into the page origin's localStorage. A
 *   document_start content script shares the page's localStorage and can read
 *   it SYNCHRONOUSLY, so we can build and inject the exact stylesheet before
 *   the first paint, then reconcile against chrome.storage a tick later.
 *   localStorage here is a cache, never the source of truth.
 *
 * PROBLEM 2: YouTube is an SPA that re-renders constantly.
 *   Removing nodes with JS means fighting a MutationObserver war forever,
 *   burning CPU and occasionally breaking YouTube's own code.
 *
 *   FIX: hide with CSS. One stylesheet, applied once, survives every
 *   re-render for free. JS is reserved for things CSS genuinely cannot do
 *   (redirects, clicking the autoplay toggle, collapsing comments).
 *
 * PROBLEM 3: page-type scoping.
 *   A rule meant for the homepage must not fire on a channel page that happens
 *   to use the same renderer. We stamp <html> with data-qt-page and scope
 *   every rule to it. main.js keeps that attribute current across SPA nav.
 */
(function () {
  const CACHE_KEY = 'qt:flags:v1';
  const STYLE_ID = 'qt-style';

  const PAGE_SCOPE = {
    home:    'html[data-qt-page="home"]',
    watch:   'html[data-qt-page="watch"]',
    search:  'html[data-qt-page="search"]',
    subs:    'html[data-qt-page="subs"]',
    channel: 'html[data-qt-page="channel"]',
    shorts:  'html[data-qt-page="shorts"]',
    all:     'html',
  };

  /** Read the synchronous cache. Returns null if absent or unparseable. */
  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeCache(flags) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(flags));
    } catch {
      /* storage disabled — we just lose the no-flash optimisation */
    }
  }

  /** Build the full stylesheet text for a set of flags. */
  function buildCss(flags) {
    const out = [];
    for (const f of globalThis.QT.cssFeatures) {
      if (!flags[f.id]) continue;
      if (!f.sel || !f.sel.length) continue;
      // `style: true` means this feature's visual treatment is a hand-written
      // rule further down (a filter, an opacity), NOT display:none. Without
      // this guard, grayscale_thumbs would hide every thumbnail instead of
      // desaturating it. Caught by tests/engine.spec.js.
      if (f.style) continue;
      const scope = PAGE_SCOPE[f.pages] || PAGE_SCOPE.all;
      const rules = f.sel.map((s) => `${scope} ${s}`).join(',\n');
      out.push(`/* ${f.id} */\n${rules} { display: none !important; }`);
    }

    // Non-"display:none" features live here. Keep the list short and explicit.
    if (flags.grayscale_thumbs && !flags.hide_thumbs) {
      out.push(
        `/* grayscale_thumbs */\nytd-thumbnail img, yt-image img, .yt-core-image { filter: grayscale(1) !important; transition: filter .18s; }\nytd-thumbnail:hover img { filter: grayscale(0) !important; }`
      );
    }
    if (flags.dim_ui) {
      out.push(`/* dim_ui */\n#masthead-container, ytd-guide-renderer { opacity: .45 !important; transition: opacity .2s; }\n#masthead-container:hover, ytd-guide-renderer:hover { opacity: 1 !important; }`);
    }
    if (flags.watch_sidebar && flags.watch_sidebar_widen) {
      // Reclaim the column the sidebar left behind.
      out.push(
        `/* watch_sidebar_widen */\nhtml[data-qt-page="watch"] ytd-watch-flexy[flexy] #primary.ytd-watch-flexy { max-width: none !important; }\nhtml[data-qt-page="watch"] ytd-watch-flexy #columns { max-width: 1600px !important; margin: 0 auto !important; }`
      );
    }
    return out.join('\n\n');
  }

  /** Inject or replace the stylesheet. Safe to call before <head> exists. */
  function apply(flags) {
    const css = buildCss(flags);
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      // documentElement always exists at document_start; head may not.
      (document.head || document.documentElement).appendChild(el);
    }
    if (el.textContent !== css) el.textContent = css;
  }

  globalThis.QT = Object.assign(globalThis.QT || {}, {
    css: { apply, buildCss, readCache, writeCache, CACHE_KEY, STYLE_ID },
  });

  // Fire immediately with the cached flags — this is the no-flash path.
  const cached = readCache();
  if (cached) apply(cached);
})();

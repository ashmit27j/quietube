# Quiet — Distraction Free for YouTube

A free, open-source Chrome MV3 extension that hides distracting parts of YouTube.
Built as a no-paywall replacement for **DF Tube**, aiming to beat **Unhook** on
granularity, resilience and behaviour.

**Read `docs/SPEC.md` before your first change. Read `docs/DECISIONS.md` before
arguing with any of the rules below — each one is there because the obvious
alternative was tried and rejected.**

---

## The five rules

1. **The registry is the source of truth.** Every YouTube selector in this
   codebase lives in `src/lib/registry.js` and nowhere else. Options UI,
   injected CSS, behaviour dispatch, mode defaults and the health check are all
   generated from it. If you are writing a `querySelector('ytd-…')` outside
   `registry.js` or `behaviours.js`, stop and add a registry entry instead.

2. **CSS hides, JS only acts.** YouTube is an SPA that re-renders constantly.
   A CSS rule applied once survives every re-render for free; a JS node-removal
   loop fights the framework forever, burns CPU, and occasionally breaks
   YouTube's own code. Use `kind: 'js'` only for things CSS provably cannot do:
   redirects, clicking player controls, inserting our own UI.

3. **No build step.** Plain JS, plain CSS, classic scripts, one global
   namespace (`globalThis.QT`). `src/` loads unpacked as-is. This keeps the
   Chrome Web Store review surface tiny and means the repo cannot rot when a
   toolchain does. Do not introduce TypeScript, a bundler, or ESM in content
   scripts without updating `docs/DECISIONS.md` first — MV3 content scripts are
   classic scripts and cannot `import`.

4. **Permissions stay at `storage` + `*://*.youtube.com/*`.** DF Tube asks for
   `tabs` and `notifications`; we do not need either and not asking is part of
   the pitch. Any PR that adds a permission must justify it in `DECISIONS.md`
   and update `docs/PRIVACY.md` and the store listing justification.

5. **Nothing leaves the browser. Ever.** No analytics, no remote config, no
   telemetry, no accounts, no network requests of any kind. This is a hard
   product constraint, not a default. `fetch`/`XMLHttpRequest` should not appear
   in this codebase.

---

## Layout

```
src/
  manifest.json          MV3 manifest. Content script file ORDER matters.
  lib/
    registry.js          ← the feature registry. Start here.
    storage.js           storage shape, migrations, mode/override/peek resolution
  content/
    css-engine.js        builds + injects the stylesheet; the no-flash path
    behaviours.js        the handful of JS handlers
    main.js              page classification, SPA nav, wiring
  background/
    service-worker.js    keyboard commands + install defaults. Stateless.
  options/               full settings page, generated from the registry
  popup/                 mode switcher + peek
  styles/injected.css    styles for OUR injected UI only, never for hiding YouTube
docs/                    spec, architecture, decisions, competitors, release
tests/                   Playwright selector-health checks
.claude/                 project skills and slash commands
```

## Load order (do not reorder casually)

`registry.js → storage.js → css-engine.js → behaviours.js → main.js`

`css-engine.js` applies the cached stylesheet **at parse time**, before
`main.js` has awaited storage. That is what eliminates the flash of
recommendations that every competitor has. See `docs/ARCHITECTURE.md §No-flash`.

## Local dev

```bash
# load unpacked
chrome://extensions → Developer mode → Load unpacked → select ./src

# after editing a content script: hit reload on the card, then hard-reload YouTube
# after editing registry.js only: the options page and CSS both regenerate on reload
```

There is no `npm install` for the extension itself. `npm i` at the repo root
only installs Playwright for `tests/`.

```bash
npm run test        # 60 offline tests — run this after every change
npm run check       # tests + release gate (permissions, icons, no network code)
npm run test:live   # selectors against real YouTube — needs network
```

## Commands available in this repo

- `/add-toggle` — add a new feature end-to-end (registry entry, mode defaults,
  docs row, health-check case) without touching five files by hand.
- `/audit-selectors` — check every registry selector against live YouTube and
  report which ones have gone stale.
- `/release` — version bump, changelog, zip, store-listing checklist.

## Skills in this repo

- `yt-selector-audit` — how to find a stable selector for a YouTube element,
  the three-tier stability rules, and how to verify with Playwright.
- `mv3-conventions` — Manifest V3 gotchas that bite this project specifically.
- `cws-release` — Chrome Web Store submission, trademark naming rules, and the
  permission-justification text reviewers ask for.

## Two things that will trip you up

1. **Content scripts run in an isolated world.** `globalThis.QT` is invisible to
   YouTube's own scripts and to `page.evaluate` in tests. Assert on effects, not
   on `QT`. See DECISIONS.md D13.
2. **`style: true`.** A feature that changes how something *looks* (a filter, an
   opacity, a layout change) rather than removing it must set `style: true`, or
   the generic hide loop will `display:none` it as well. See D12.

## What "done" means for a feature

- [ ] registry entry with `sel` ordered most-stable-first and a `risk` rating
- [ ] sensible default in all three modes (`study` / `music` / `casual`)
- [ ] verified on a real page at all three widths (mobile-ish 800px, 1280, 1920)
- [ ] verified it does NOT fire on the other page types (`data-qt-page` scoping)
- [ ] a case in `tests/selectors.spec.js`
- [ ] a row in `docs/FEATURES.md`

## Style

- No semicolon-free style; keep the existing 2-space, semicolon, single-quote JS.
- Comments explain *why*, not *what*. The codebase is small; the reasoning is
  the valuable part.
- British/American spelling: the code uses `behaviour` in filenames and
  identifiers. Stay consistent with what is there.

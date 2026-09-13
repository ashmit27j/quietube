# Architecture

## Core + packs

The extension is one generic engine (`src/core/`) plus one file per site
(`src/packs/<id>.js`). Core has no idea what YouTube, Reddit, or any other
site looks like — it only knows the **pack contract**:

```
{
  id:        stable slug, also the site key in storage and in data-qs-site.
  label:     display name for the options page / popup.
  hosts:     match patterns for manifest.json's content_scripts + host
             permissions for this pack.
  pages:     { [pageName]: (url: URL) => boolean } — classifies the current
             URL into one of this pack's own page names, checked by
             core/main.js in declaration order. No name is reserved except
             'all', which every pack gets for free as a feature's `pages`
             value meaning "every page type".
  groups:    options-page sections. [{ id, label, blurb }]
  features:  the registry — every selector this pack uses lives here and
             nowhere else. See the field reference in packs/<id>.js.
  handlers:  { [name]: (ctx) => cleanupFn | void } for kind:'js'/'both'
             features. core/main.js merges these with core/behaviours.js
             (core wins a name collision; none exists today).
  modes:     { [modeName]: { label, blurb } } — the pack's OWN modes.
             'off' and 'custom' are core concepts every pack gets for free
             and must not be redeclared here.
}
```

Two optional extension hooks beyond the required shape:

- `customBaseMode` — which of the pack's own modes `'custom'` starts from.
- `navEvents: string[]` — custom DOM events the site's own SPA router fires
  on navigation, for an instant reaction. Purely an optimisation: the
  generic href-poll in `core/main.js` always catches up within 800ms.
- `buildExtraCss(flags, pageScope)` — raw CSS for `style: true` features (a
  filter, an opacity, a layout change) that the generic hide loop in
  `core/engine.js` skips — see D12. `pageScope` maps the pack's own page
  names (plus `'all'`) to their `html[data-qs-page="…"]` selector, so a rule
  can be page-scoped without the pack hardcoding the attribute name itself.

**Rule:** `core/` must contain zero site-specific selectors, hostnames or
page-type names. When it doesn't, a site pack is inert until its
`content_scripts` entry loads, and adding a second pack changes nothing
about the first. Grepping `src/core/*.js` for a pack's own vocabulary
(`ytd-`, `youtube`, whole-word `shorts` for the YouTube pack) is a fast way
to catch a leak — `tests/registry.spec.js` runs exactly that check. `watch`
is deliberately excluded from the automated check (it's an ordinary English
word as often as a page name — see `core/storage.js`'s default placeholder
text, "What did you come here to watch?") and stays a manual grep instead.

Only one *handler* is genuinely site-agnostic enough to live whole in
`core/behaviours.js`: `pauseOnBlur`, because it touches only the standard
`<video>` element. Every other current handler (`shortsRedirect`,
`redirectHomeToSubs`, `forceAutoplayOff`, `disableAmbient`, `homePlaceholder`,
`exploreTrending` on YouTube; Reddit's own comment-collapse) is site-specific
and lives in its pack. A feature's *registry entry* stays with the pack whose
options page shows it even when its *handler implementation* lives in core
(see `pause_on_blur` in `packs/youtube.js`).

One *choreography* turned out to be generic even though no single handler
using it could be: both packs' comment-collapse feature hides a root element
behind a "Show comments" reveal button, and the only pack-specific parts are
the selector and the button's copy. That's `core/dom.js`'s
`collapseWithReveal(selector, {buttonClass, buttonText})` — each pack's own
handler is a one-line call into it (see `docs/DECISIONS.md` D15 for how this
boundary correction was found).

## Data flow

```
                      chrome.storage.sync
                             │  (source of truth)
                             ▼
                    storage.load() ─► migrate()
                             │
                             ▼
   resolve(cfg) = masterEnabled ▸ site modeDefaults ▸ custom ▸ overrides ▸ peek
                     (modeDefaults comes from globalThis.QS.pack)
                             │
                 ┌───────────┴────────────┐
                 ▼                        ▼
        css.buildCss(flags)        runBehaviours(page)
                 │                        │
                 ▼                        ▼
        <style id="qs-style">   handlers: core + pack, merged
                 │                        │
                 └──────► the site ◄──────┘
                             ▲
                             │ (synchronous cache)
                    localStorage['qs:flags:v1']
```

## No-flash (the important bit)

A content script at `document_start` runs before the page's own scripts, but
`chrome.storage` is promise-based. Any extension that does

```js
const cfg = await chrome.storage.sync.get();   // ← one frame paints here
injectCss(cfg);
```

will show the full page for one frame on every cold load. That flash is the
single most common complaint across DF Tube, Unhook and DF YouTube reviews.

QuietSurf mirrors the *resolved* flags into the page origin's `localStorage`,
which a content script can read **synchronously**:

1. `core/engine.js` runs at parse time (after the pack has already loaded —
   see load order below), reads `localStorage['qs:flags:v1']`, builds the
   stylesheet string and appends a `<style>` to `document.documentElement` —
   all before the parser reaches `<body>`.
2. `core/main.js` then awaits `chrome.storage`, resolves for real, rewrites
   the cache and re-applies. If the two agree (the normal case) the second
   apply is a no-op because `css.apply` compares `textContent` first.

The cache is never authoritative. A cold profile, a cleared cache, or blocked
storage simply falls back to the async path — the same behaviour the
competitors have, and only on the very first page load. The cache lives in
the page's own origin, so each site's pack gets an isolated cache for free.

## Page scoping

`core/main.js` asks the active pack's `pages` predicates which page type the
current URL is, and stamps `<html data-qs-page="watch" data-qs-site="youtube">`.
Every generated rule is prefixed with the matching page scope, so a selector
meant for search results cannot fire on a channel page that reuses the same
renderer. The stamp is refreshed on the pack's own `navEvents` (if any) and by
an 800ms href poll (some transitions, notably YouTube's Shorts redirect, do
not fire a framework navigation event).

## Why there is no global MutationObserver

There isn't one, and adding one should be treated as a design failure. CSS
handles every hiding case; the JS handlers that do need to react
(`forceAutoplayOff`, `disableAmbient`) use a bounded 2–3s interval scoped to
one page type and are torn down on navigation. Total idle cost is two timers.

## Handler lifecycle

```
navigate → teardown() (run every stored cleanup) → runBehaviours(page)
```

Every handler must be idempotent and may return a cleanup function. A handler
that throws is caught and logged; it never blocks the others. A registry
entry naming a handler that does not exist logs a clear warning rather than
failing silently — that warning is the fastest signal that a feature was
half-added.

## Storage shape

```jsonc
{
  "schema": 2,
  "masterEnabled": true,
  "sites": {
    "youtube": {
      "mode": "study",
      "custom": { "home_feed": true },
      "overrides": { "comments_hide": true },
      "quick": ["watch_sidebar", "comments_collapse", "shorts_shelf"]
    }
  },
  "schedule": { "enabled": true, "rules": [
    { "days": [1,2,3,4,5], "from": "09:00", "to": "17:00", "mode": "study" }
  ]},
  "peekUntil": 0
}
```

`sites` is keyed by `pack.id`; `core/storage.js` never names one — a new
pack's site record is seeded on first `load()` via `siteDefaults(pack)`.
`masterEnabled: false` is checked before anything else in `resolve()`, so a
site being off is not the same as the whole extension being off. `schedule`
and `peekUntil` are deliberately NOT per-site: one set of time windows or one
peek applies across every site at once.

This is schema 2. Schema 1 was the same shape flattened at the top level for
a single site, with no `masterEnabled` or `quick`. The schema 1 → 2 migration
in `core/storage.js → migrate()` wraps the old flat `mode`/`custom`/
`overrides` under `sites[pack.id]`. Never rename a registry `id`; add a new
one and migrate the old key.

## Adding a feature

Use `/add-toggle`, or by hand:

1. Add an entry to `features` in `src/packs/<id>.js` — `sel` ordered
   most-stable-first, a `risk` rating, a `verified` status, and a default for
   each mode the pack declares.
2. If `kind: 'js'`, implement the handler in the pack's `handlers` object (or
   `core/behaviours.js` if it is genuinely site-agnostic) with the exact
   `handler` name. Return a cleanup function if it attaches anything.
3. Add a case to `tests/selectors.spec.js`.
4. Regenerate `docs/FEATURES.md` (`node tools/gen-features.mjs`).

The options page and the stylesheet need no edits — both are generated.

## Selector stability tiers

| Tier | Example | Stability | Use |
|---|---|---|---|
| 1 | `ytd-rich-grid-renderer` | high — these custom element names change rarely | default |
| 2 | `#secondary`, `[page-subtype="home"]` | medium | when tier 1 is too broad |
| 3 | `.ytp-endscreen-content` | low — sites churn classes | last resort, mark `risk:'high'` |

Put several in the `sel` array; extras that match nothing cost nothing. Tier-3
selectors get the "fragile" badge in the options UI so a user whose toggle
breaks knows why, and `/audit-selectors` checks them first.

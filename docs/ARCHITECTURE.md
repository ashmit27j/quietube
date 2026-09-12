# Architecture

## Data flow

```
                      chrome.storage.sync
                             │  (source of truth)
                             ▼
                    storage.load() ─► migrate()
                             │
                             ▼
        resolve(cfg) = modeDefaults ▸ custom ▸ overrides ▸ peek
                             │
                 ┌───────────┴────────────┐
                 ▼                        ▼
        css.buildCss(flags)        runBehaviours(page)
                 │                        │
                 ▼                        ▼
        <style id="qt-style">      handlers in behaviours.js
                 │                        │
                 └──────► youtube.com ◄───┘
                             ▲
                             │ (synchronous cache)
                    localStorage['qt:flags:v1']
```

## No-flash (the important bit)

A content script at `document_start` runs before the page's own scripts, but
`chrome.storage` is promise-based. Any extension that does

```js
const cfg = await chrome.storage.sync.get();   // ← one frame paints here
injectCss(cfg);
```

will show the full YouTube homepage for one frame on every cold load. That
flash is the single most common complaint across DF Tube, Unhook and DF YouTube
reviews.

Quiet mirrors the *resolved* flags into the page origin's `localStorage`, which
a content script can read **synchronously**:

1. `css-engine.js` runs at parse time, reads `localStorage['qt:flags:v1']`,
   builds the stylesheet string and appends a `<style>` to
   `document.documentElement` — all before the parser reaches `<body>`.
2. `main.js` then awaits `chrome.storage`, resolves for real, rewrites the
   cache and re-applies. If the two agree (the normal case) the second apply is
   a no-op because `css.apply` compares `textContent` first.

The cache is never authoritative. A cold profile, a cleared cache, or blocked
storage simply falls back to the async path — the same behaviour the
competitors have, and only on the very first page load.

## Page scoping

`main.js` classifies the URL and stamps `<html data-qt-page="watch">`. Every
generated rule is prefixed with that scope, so a selector meant for search
results cannot fire on a channel page that reuses the same renderer. The stamp
is refreshed on `yt-navigate-finish` and by an 800ms href poll (some
transitions, notably the Shorts redirect, do not fire the event).

## Why there is no global MutationObserver

There isn't one, and adding one should be treated as a design failure. CSS
handles every hiding case; the JS handlers that do need to react
(`forceAutoplayOff`, `disableAmbient`) use a bounded 2–3s interval scoped to the
watch page and are torn down on navigation. Total idle cost is two timers.

## Handler lifecycle

```
navigate → teardown() (run every stored cleanup) → runBehaviours(page)
```

Every handler must be idempotent and may return a cleanup function. A handler
that throws is caught and logged; it never blocks the others. A registry entry
naming a handler that does not exist logs a clear warning rather than failing
silently — that warning is the fastest signal that a feature was half-added.

## Storage shape

```jsonc
{
  "schema": 1,
  "mode": "study",
  "custom": { "home_feed": true },
  "overrides": { "comments_hide": true },
  "schedule": { "enabled": true, "rules": [
    { "days": [1,2,3,4,5], "from": "09:00", "to": "17:00", "mode": "study" }
  ]},
  "peekUntil": 0,
  "placeholderText": "What did you come here to watch?"
}
```

Migrations go in `storage.js → migrate()`, one branch per schema bump. Never
rename a registry `id`; add a new one and migrate the old key.

## Adding a feature

Use `/add-toggle`, or by hand:

1. Add an entry to `REGISTRY` in `src/lib/registry.js` — `sel` ordered
   most-stable-first, a `risk` rating, and a default for each of
   `study` / `music` / `casual`.
2. If `kind: 'js'`, implement the handler in `behaviours.js` with the exact
   `handler` name. Return a cleanup function if it attaches anything.
3. Add a case to `tests/selectors.spec.js`.
4. Regenerate `docs/FEATURES.md` (`node tools/gen-features.mjs`).

The options page and the stylesheet need no edits — both are generated.

## Selector stability tiers

| Tier | Example | Stability | Use |
|---|---|---|---|
| 1 | `ytd-rich-grid-renderer` | high — these custom element names change rarely | default |
| 2 | `#secondary`, `[page-subtype="home"]` | medium | when tier 1 is too broad |
| 3 | `.ytp-endscreen-content` | low — YouTube churns classes | last resort, mark `risk:'high'` |

Put several in the `sel` array; extras that match nothing cost nothing. Tier-3
selectors get the "fragile" badge in the options UI so a user whose toggle
breaks knows why, and `/audit-selectors` checks them first.

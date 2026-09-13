---
name: mv3-conventions
description: Manifest V3 rules and gotchas that specifically bite this extension. Use when editing manifest.json, the service worker, storage code, content script load order, or when something works in the console but not in the extension.
---

# MV3 conventions for this project

## Content scripts are classic scripts
They cannot use `import`/`export`. That is why every pack publishes
`globalThis.QS` and why a pack's load order (registered in
`background/pack-scripts.js`'s `QS_PACKS`) is load-bearing:

```
core/dom.js → core/storage.js → packs/<id>.js → core/engine.js → core/behaviours.js → core/main.js
```

Reordering these breaks the extension silently — a later file will read an
undefined property off `QS`. If you add a file, insert it in dependency order
and say why in the `pack-scripts.js` diff (there is no manifest
`content_scripts` array to diff any more — see Permissions below).

The **service worker** is a classic script too (`importScripts`, not
`"type": "module"`), and the options and popup pages load the same core/pack
files via `<script src>` tags. Keep every shared file working as a classic
script so all three contexts can use it.

## Content scripts run in an isolated world
Your content script gets its own JS global scope. `globalThis.QS` is **not**
visible to the page's own scripts, and the page's globals are not visible to
you — though you share the DOM, and you share `localStorage` on the page
origin (which is exactly what the no-flash cache relies on).

Consequences that bite:
- You cannot call a site's internal player API directly. Reach a `<video>`
  through the DOM or by clicking its controls, as YouTube's
  `forceAutoplayOff` does.
- Any Playwright test that does `page.evaluate(() => globalThis.QS)` gets
  `undefined`. Assert on effects instead: the `data-qs-page`/`data-qs-site`
  stamps, the `#qs-style` element, the localStorage cache.
  `tests/extension.spec.js` asserts the isolation explicitly so a leak into
  the page fails loudly.
- This isolation is a security property worth keeping. Do not inject a script
  tag into the page to escape it.

## `document_start` and the DOM
At `document_start`, `document.documentElement` exists but `document.head` and
`document.body` may not. Always append with
`(document.head || document.documentElement)`. Never assume `body`.

## The service worker is not a background page
It is terminated after ~30s idle and restarted on demand. Therefore:
- No module-level mutable state that matters. Anything durable goes in
  `chrome.storage`.
- No `setTimeout` longer than a few seconds; use `chrome.alarms` if ever needed
  (it would require the `alarms` permission — see D5 before adding it).
- Event listeners must be registered **synchronously at the top level**, not
  inside an `await`. A listener registered after an await is missed on a cold
  start.

## Storage
- `chrome.storage.sync` quotas: 102,400 bytes total, 8,192 per item, 120
  writes/minute, 1,800 writes/hour. The options page writes on each toggle —
  fine for a human, but never write in a loop.
- `chrome.storage.onChanged` fires in every context including the one that
  wrote. Re-render idempotently; do not assume a change came from elsewhere.
- Always fall back to `chrome.storage.local` — some managed profiles disable
  sync, and `chrome.storage.sync` is then `undefined`, not merely empty.

## Permissions
`storage` + `scripting` + `activeTab`, with `host_permissions: []` — every
pack's host lives in `optional_host_permissions` and is requested on first
use (D16). Specifically:
- Redirects are done with `location.replace` in the content script, **not**
  `chrome.tabs.update` — no `tabs` permission needed.
- The options page is opened with `chrome.runtime.openOptionsPage()` — no
  `tabs` permission needed.
- There is no static `content_scripts` manifest entry any more — a pack's
  scripts are registered dynamically via `chrome.scripting
  .registerContentScripts()` once its host permission is granted (see
  `background/pack-scripts.js`), which is what costs `scripting`. A static
  entry doesn't retroactively fire once a permission is granted mid-session.
- With `host_permissions` empty, `chrome.tabs.query()` hides `url`/`title`
  for tabs the extension has no host permission for — including from the
  popup, which needs the URL just to decide which pack (if any) applies.
  `activeTab` is what reveals it: a silent permission that activates only
  when the user invokes the extension directly (opening the popup counts).
- `chrome.permissions.request()` must be called from a user gesture in a
  foreground page (popup or options), never from the service worker, and its
  approval UI is a native browser surface no automated test can click
  through — see D16.
- `commands` in the manifest is a *manifest key*, not a permission — keyboard
  shortcuts are free.

## CSP
Extension pages run under a strict CSP: no inline `<script>`, no
`eval`, no remote scripts. All popup/options JS must be in separate files
referenced by `src`. No CDN links anywhere.

## Testing an unpacked reload
Changing a content script requires: reload the extension card **and** hard
reload a tab on that pack's site. Changing the service worker requires a card
reload only — that also re-runs `background/pack-scripts.js`'s sync, so it's
the fastest way to pick up a `QS_PACKS` edit. Changing the manifest requires a
card reload; `chrome://extensions` will show the parse error inline if the
JSON is malformed — check there first when "nothing happens". If a pack you
already granted stops responding after an edit, check
`chrome.scripting.getRegisteredContentScripts()` from the service worker's
console — a stale registration from before the edit can outlive a card reload.

## Chrome Web Store review implications
- Minified or obfuscated code triggers a slower manual review. This project
  ships readable source deliberately (D1).
- The single purpose declaration must match what the code does — currently
  "hide user-selected distracting parts of supported sites' interfaces".
- Every requested permission needs a one-line justification in the dashboard;
  keep the text in `store/LISTING.md` in sync with the manifest.

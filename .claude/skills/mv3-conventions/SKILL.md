---
name: mv3-conventions
description: Manifest V3 rules and gotchas that specifically bite this extension. Use when editing manifest.json, the service worker, storage code, content script load order, or when something works in the console but not in the extension.
---

# MV3 conventions for this project

## Content scripts are classic scripts
They cannot use `import`/`export`. That is why `registry.js` publishes
`globalThis.QT` and why the `content_scripts.js` array order is load-bearing:

```
lib/registry.js → lib/storage.js → content/css-engine.js → content/behaviours.js → content/main.js
```

Reordering these breaks the extension silently — a later file will read an
undefined property off `QT`. If you add a file, insert it in dependency order
and say why in the manifest diff.

The **service worker** may be a module (`"type": "module"`), and the options
and popup pages load the same files via `<script src>` tags. Keep every shared
file working as a classic script so all three contexts can use it.

## Content scripts run in an isolated world
Your content script gets its own JS global scope. `globalThis.QT` is **not**
visible to YouTube's own scripts, and YouTube's globals are not visible to you —
though you share the DOM, and you share `localStorage` on the page origin (which
is exactly what the no-flash cache relies on).

Consequences that bite:
- You cannot call YouTube's internal player API directly. Reach the player
  through the DOM (`document.querySelector('video.html5-main-video')`) or by
  clicking its controls, as `forceAutoplayOff` does.
- Any Playwright test that does `page.evaluate(() => globalThis.QT)` gets
  `undefined`. Assert on effects instead: the `data-qt-page` stamp, the
  `#qt-style` element, the localStorage cache. `tests/extension.spec.js` asserts
  the isolation explicitly so a leak into the page fails loudly.
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
Current set is `storage` + `host_permissions: ["*://*.youtube.com/*"]` and it
stays that way (decision D5). Specifically:
- Redirects are done with `location.replace` in the content script, **not**
  `chrome.tabs.update` — no `tabs` permission needed.
- The options page is opened with `chrome.runtime.openOptionsPage()` — no
  `tabs` permission needed.
- Do not add `scripting`; everything is declared in `content_scripts`.
- `commands` in the manifest is a *manifest key*, not a permission — keyboard
  shortcuts are free.

## CSP
Extension pages run under a strict CSP: no inline `<script>`, no
`eval`, no remote scripts. All popup/options JS must be in separate files
referenced by `src`. No CDN links anywhere.

## Testing an unpacked reload
Changing a content script requires: reload the extension card **and** hard
reload the YouTube tab. Changing the service worker requires a card reload
only. Changing the manifest requires a card reload; `chrome://extensions` will
show the parse error inline if the JSON is malformed — check there first when
"nothing happens".

## Chrome Web Store review implications
- Minified or obfuscated code triggers a slower manual review. This project
  ships readable source deliberately (D1).
- The single purpose declaration must match what the code does. Ours is
  "hide user-selected parts of the YouTube interface".
- Every requested permission needs a one-line justification in the dashboard;
  keep the text in `docs/STORE_LISTING.md` in sync with the manifest.

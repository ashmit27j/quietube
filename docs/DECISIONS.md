# Decision log

Append-only. Each entry says what was chosen, what was rejected, and what would
change the answer. If you are about to do the opposite of one of these, read the
entry first — the obvious alternative was usually already tried.

---

## D1 — Vanilla JS, no build step
**Chosen:** plain classic scripts, one global namespace `globalThis.QT`, `src/`
loads unpacked directly.
**Rejected:** TypeScript + Vite + React popup.
**Why:** the entire codebase is ~1,500 lines of glue around a data table. A
bundler buys types and JSX at the cost of a toolchain that rots, a dist/src
divergence, and a much larger diff for a Chrome Web Store reviewer to read
(reviewers read the uploaded bundle, and minified output triggers manual
review). Extension review latency is a real cost.
**Would change if:** the registry grows past ~100 features, or a second browser
target needs conditional builds.

## D2 — Content scripts are classic scripts, so the registry publishes a global
**Chosen:** `registry.js` ends with `globalThis.QT = Object.assign(...)` and is
listed first in `content_scripts.js`.
**Rejected:** ESM with `import`.
**Why:** MV3 `content_scripts` cannot be modules. The alternatives are a
bundler (see D1) or `chrome.runtime.getURL` + dynamic `import()` from an
injected module script, which reintroduces async and therefore the flash.
**Consequence:** the file order in `manifest.json` is load-bearing. Documented
in CLAUDE.md.

## D3 — Hide with CSS, not by removing nodes
**Chosen:** one generated stylesheet, injected once, scoped by
`html[data-qt-page]`.
**Rejected:** MutationObserver + `element.remove()`.
**Why:** YouTube's Polymer app re-renders aggressively; removing its nodes
means an observer that fires thousands of times per session, measurable CPU
cost, and occasional breakage of YouTube's own handlers (people report broken
playlists and stuck loading spinners in competitor reviews, and this is why).
CSS costs nothing after the first application and cannot desync.
**Would change if:** a target element cannot be selected by CSS at all — then
it becomes a `kind: 'js'` registry entry, not a blanket policy change.

## D4 — localStorage mirror for a synchronous no-flash path
**Chosen:** resolved flags are mirrored into the youtube.com origin's
`localStorage`; `css-engine.js` reads it synchronously at `document_start` and
injects the stylesheet before first paint, then `main.js` reconciles against
`chrome.storage` asynchronously.
**Rejected:** (a) awaiting `chrome.storage` before injecting — guarantees one
painted frame of the full feed, which is the most-complained-about flaw in
every competitor; (b) a static "hide everything" stylesheet that gets relaxed
later — breaks the page for users who have most toggles off.
**Risk accepted:** `localStorage` can be cleared or blocked. It is a cache
only; a miss degrades to the (visible) async path, never to wrong behaviour.

## D5 — Permissions: `storage` + `*://*.youtube.com/*`, nothing else
**Chosen:** minimum viable permission set.
**Rejected:** `tabs` (DF Tube requests it), `notifications`, `scripting`,
`declarativeNetRequest`.
**Why:** it is a listed differentiator, it speeds up review, and every extra
permission is a scarier install-time prompt. The Shorts redirect is done with
`location.replace` from the content script, not with the `tabs` API.
**Would change if:** a feature genuinely requires it — then it must also update
`docs/PRIVACY.md` and the store justification text.

## D6 — `storage.sync`, not `storage.local`
**Chosen:** sync, with an automatic fall back to local if unavailable.
**Why:** settings follow the user across machines for free; the payload is a
few hundred bytes, far under the 8KB-per-item and 102KB-total quotas.
**Watch out:** `storage.sync` has a write-rate quota (120 writes/min). The
options page writes on every toggle; if a future UI writes in a loop, debounce.

## D7 — Overrides layer on modes instead of dropping into "custom"
**Chosen:** `resolve()` layers mode defaults → custom set → per-feature
overrides → peek.
**Rejected:** flipping any toggle switches the user to Custom mode.
**Why:** with 40 toggles, a user who changes one thing should not lose the
preset system. The options page shows an "overridden" marker and a one-click
clear, so the state is never mysterious.

## D8 — Comments collapse by default rather than hide
**Chosen:** `comments_collapse` (a "Show comments" button) is the mode default;
`comments_hide` exists but is off.
**Why:** the dominant churn mechanism for focus extensions is *user needs the
hidden thing once → disables the whole extension → never re-enables*. Every
hiding decision should have a cheap, in-place escape hatch. Same reasoning
produced Peek (D9).

## D9 — Peek is time-boxed, not a toggle
**Chosen:** `Alt+Shift+P` reveals everything for 30s and auto-expires.
**Rejected:** a "pause extension" button.
**Why:** a pause with no expiry is just an uninstall with extra steps.

## D10 — Name and trademark posture
**Chosen:** working name **"Quiet — Distraction Free for YouTube"**.
Chrome Web Store rules: the name may not *begin* with "YouTube", must not imply
affiliation, and the listing must carry a disclaimer. The options page footer
and the store description both say "Not affiliated with YouTube or Google."
**Open:** final name is not locked. Check availability on the Web Store and as
a domain before the first submission.

## D11 — Music mode deliberately keeps recommendations
**Chosen:** `mixes` and `playlists_sitewide` default OFF in Music mode.
**Why:** every competitor treats "related video" as universally bad, which
breaks the single most common benign use of YouTube. Being the tool that does
not ruin music listening is cheap to build and easy to say in the listing.

## D12 — `style: true` separates "hide it" from "change how it looks"
**Chosen:** registry entries whose visual treatment is a filter, an opacity or
a layout change carry `style: true`, and the generic hide loop in
`css-engine.js` skips them.
**Why:** without it, `grayscale_thumbs` matched the generic loop AND the
hand-written filter rule, so turning grayscale on hid every thumbnail instead
of desaturating it. Caught by `tests/engine.spec.js`, not by inspection — which
is the argument for that test file existing.
**Rule:** any new feature that changes appearance rather than removing an
element must set `style: true` and add its rule to `buildCss`.

## D13 — Content scripts run in an isolated world, and that is load-bearing
**Observed:** `globalThis.QT` is not reachable from the page's main world.
**Why it matters:** YouTube's own scripts cannot read or tamper with our
state, which is a real security property and worth keeping. It also means any
test that asserts on `QT` from `page.evaluate` will fail — assert on the
*effects* instead (the `data-qt-page` stamp, the `#qt-style` element, the
localStorage cache). `tests/extension.spec.js` asserts the isolation explicitly
so a future change that leaks into the page fails loudly.

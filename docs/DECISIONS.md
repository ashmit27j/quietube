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

## D14 — Live selector audits need a real account, and some redesigns beat CSS
**Observed (2026-09, first `/audit-selectors` run):** running `tests/selectors.spec.js`
against a fresh, signed-out, no-watch-history Chromium profile reports ~37 of
~50 features as broken. Almost all of that is not stale selectors:
- A signed-out, history-less session gets an **empty personalized home feed**
  ("Try searching to get started") and an empty watch-page related sidebar, so
  every feed/recommendation-shaped feature (`home_chips`, `home_ads`, `mixes`,
  `grayscale_thumbs` on those surfaces) has nothing to match — correctly.
- The automated session was **never served an ad**, on any page, in two full
  runs. `home_ads` / `search_ads` cannot be verified this way at all.
- `notification_bell` only renders when **signed in** — same constraint as the
  `subs` page, just not previously called out in `NEEDS_AUTH`.
- Two class names came back **inconsistently between identical runs**
  (`like_counts`'s text-content class), which reads as a live A/B rollout
  between a dashed and a camelCase name rather than noise. Selector fixes
  under active rollout should add the new class alongside the old one, not
  replace it — both are "real" depending on which bucket a session lands in.
**Real finding:** `explore_trending` cannot be expressed as a CSS selector
any more. YouTube removed "Trending" from the guide outright and turned
"Explore" into a heading with no id, class, or attribute — only its text
distinguishes it, and this repo does not do text-content matching in
selectors (see rule 2, `docs/SPEC.md`). Fixing it for real means a `kind: 'js'`
handler that finds the heading by text and hides its parent
`ytd-guide-section-renderer`. Left broken rather than force a wrong fix.
**Rule:** treat a live audit failure as "needs investigation," not "selector is
stale," until you've confirmed real content exists on that page for a signed-in
session. A failing `risk: 'low'`/`'med'` selector on an empty feed is not a
redesign signal the way the skill's "flag low/med failures" heuristic assumes —
check for content first.

**Addendum (2026-09, `verified` field added):** the registry now carries a
`verified: 'live' | 'unverified' | 'needs-account'` field per feature so the
audit can skip known-unconfirmable cases instead of reporting false failures.
Rerunning the live audit after adding it (real network, signed-out session)
surfaced two more instances of the exact pattern this entry already describes,
plus one genuine break:
- `grayscale_thumbs` and `shorts_shelf` fail on `/` for the same reason as
  `home_chips`/`home_ads`/`mixes` above (empty personalized feed) — marked
  `unverified`, not fixed, because there is nothing wrong to fix.
- `grayscale_thumbs` also failed on `/@YouTube/videos`, a channel page with 30
  real videos — genuine content, genuine failure. Cause: channel grids now
  render thumbnails as `yt-thumbnail-view-model`, not `ytd-thumbnail` (the same
  view-model migration already noted on `like_counts`/`search_suggestions`/
  `shorts_search`). Search results still use the old element, so this is
  another A/B rollout, not a full replacement — the new selector was added
  alongside the old one on both `grayscale_thumbs` and `hide_thumbs` (the
  latter hadn't failed yet only because a stray `ytd-thumbnail` elsewhere on
  the page kept its count above zero — a latent break, fixed defensively).
- `notification_bell`, `subs_feed` and `shorts_subs` are marked
  `needs-account` rather than `unverified`: D14's own text above already notes
  the bell "only renders when signed in — same constraint as the subs page",
  so they get the label that means "structurally requires login," not the one
  that means "session couldn't confirm either way."
- `live_chat` (needs an actual live stream, not the fixed test video) and
  `merch_shelf` (needs a channel with merch enabled) are marked `unverified`
  for the same reason: the fixed audit fixtures cannot exercise them, signed
  in or not.

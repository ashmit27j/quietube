---
name: yt-selector-audit
description: Find, verify and repair YouTube DOM selectors for this extension. Use when a toggle has stopped working, when adding a feature that hides a new YouTube element, after a YouTube redesign, or when running /audit-selectors.
---

# Auditing YouTube selectors

YouTube ships layout changes without notice, and the failure is silent: a
toggle just stops doing anything and the user blames the extension. This is the
single largest maintenance cost of the project, so treat selector work as a
first-class task, not a quick fix.

## The three tiers

Always prefer the highest tier that is specific enough.

**Tier 1 — custom element names.** `ytd-rich-grid-renderer`,
`ytd-comments`, `ytd-merch-shelf-renderer`, `yt-image`. These are Polymer
component names. They change maybe once every couple of years and changes are
loud (many extensions break at once). Default to these.

**Tier 2 — ids and semantic attributes.** `#secondary`, `#related`,
`[page-subtype="home"]`, `[is-shorts]`, `[aria-label="Shorts"]`. Stable enough,
but `id`s are reused across renderers so always pair them with a tier-1 parent
(`#secondary.ytd-watch-flexy`, not bare `#secondary`).

**Tier 3 — class names.** `.ytp-endscreen-content`, `.ytp-autonav-toggle-button`,
`.yt-spec-button-shape-next__button-text-content`. These churn. Use only when
nothing else identifies the element (the HTML5 player internals are mostly
tier 3 and there is no alternative). Mark the registry entry `risk: 'high'` so
it gets the "fragile" badge and gets checked first.

**Never** use: generated hashes, `nth-child` chains, inline style matching, or
anything that depends on sibling order.

## Finding a selector

1. Open the page in Chrome, right-click the element, Inspect.
2. Walk **up** the tree in the Elements panel until you hit a `ytd-*` / `yt-*`
   custom element that wraps exactly the thing you want and nothing more.
   Hiding the wrapper is almost always better than hiding the inner div —
   the wrapper is more stable and it collapses the layout gap too.
3. Test the candidate in the console:
   ```js
   document.querySelectorAll('YOUR_SELECTOR').length
   ```
   Then check you have not over-matched:
   ```js
   $$('YOUR_SELECTOR').forEach(e => e.style.outline = '2px solid red')
   ```
4. Check it on the **other** page types. A renderer used on the home page is
   often reused in search and on channels. If it over-matches, scope it with
   the registry's `pages` field rather than making the selector longer — page
   scoping is applied automatically via `html[data-qt-page]`.
5. Check it logged out and in a narrow window. YouTube swaps renderers at
   breakpoints and for signed-out users.

## Writing the registry entry

```js
{
  id: 'thing_name',           // never change this later; it is a storage key
  group: 'recs',
  pages: 'watch',             // scopes the rule; 'all' only if truly sitewide
  kind: 'css',                // 'js' only if CSS provably cannot do it
  risk: 'low',                // tier 1 → low, tier 2 → med, tier 3 → high
  since: 1,
  label: 'Short UI label',
  desc: 'One line the user reads.',
  sel: ['ytd-thing-renderer', '#thing.ytd-watch-flexy'],  // most stable FIRST
  modes: { study: true, music: false, casual: true },
}
```

Put two or three selectors in `sel`. They are OR'd together in the generated
CSS and a selector that matches nothing costs nothing — this is cheap
redundancy that buys resilience across YouTube A/B variants.

## Verifying with Playwright

`tests/selectors.spec.js` loads real YouTube pages and asserts each selector
matches at least one node. Run it before and after any selector change:

```bash
npx playwright test tests/selectors.spec.js
```

Notes for this environment: Chromium is preinstalled at
`/opt/pw-browsers/chromium`; do not run `playwright install`. Signed-out
YouTube is enough for every selector except subscriptions — mark those tests
`test.skip` when no session is available rather than deleting them.

## Repairing a broken selector

1. Reproduce: open the page, confirm the element is visible with the toggle on.
2. In the console, run each selector in the entry's `sel` array and find which
   ones return 0.
3. Find the replacement using the process above. **Keep the old selector in the
   array** unless you are sure it is dead everywhere — YouTube rolls changes out
   gradually and some users are still on the old layout for weeks.
4. Downgrade `risk` honestly. If the new selector is tier 3, say so.
5. Add a line to the entry's comment noting the date and what changed.
6. Bump the patch version and note it in `CHANGELOG.md`.

## The health check

`/audit-selectors` runs every registry selector against live pages and prints a
table of `id → matched / not matched`. A `not matched` on a `risk: 'low'` entry
is an alarm; on a `risk: 'high'` entry it is expected maintenance. Run it before
every release and whenever a user reports "it stopped working".

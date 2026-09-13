---
name: site-selector-audit
description: Find, verify and repair DOM selectors for any pack in this extension (YouTube, Reddit, or a new one). Use when a toggle has stopped working, when adding a feature that hides a new element on a supported site, after that site ships a redesign, or when running /audit-selectors.
---

# Auditing pack selectors

Every site this extension supports ships layout changes without notice, and
the failure is silent: a toggle just stops doing anything and the user blames
the extension. This is the single largest maintenance cost of the project, so
treat selector work as a first-class task, not a quick fix. The method below
is the same regardless of which pack you're auditing — only the concrete
element names differ.

## The three tiers

Always prefer the highest tier that is specific enough.

**Tier 1 — custom element / component names.** On YouTube: `ytd-rich-grid-renderer`,
`ytd-comments`, `yt-image`. On Reddit: `shreddit-post`, `shreddit-comment-tree`,
`shreddit-async-loader`. These are framework component names. They change
maybe once every couple of years and changes are loud (many extensions break
at once). Default to these.

**Tier 2 — ids and semantic attributes.** `#secondary`, `[page-subtype="home"]`,
`[is-shorts]`, `[promoted]`, `[aria-label="…"]`. Stable enough, but `id`s are
often reused across components, so pair them with a tier-1 parent
(`#secondary.ytd-watch-flexy`, not bare `#secondary`).

**Tier 3 — class names.** `.ytp-endscreen-content`,
`.yt-spec-button-shape-next__button-text-content`. These churn constantly. Use
only when nothing else identifies the element. Mark the registry entry
`risk: 'high'` so it gets the "fragile" badge and gets checked first.

**Never** use: generated hashes, `nth-child` chains, inline style matching, or
anything that depends on sibling order.

## Finding a selector

1. Open the page in Chrome, right-click the element, Inspect.
2. Walk **up** the tree in the Elements panel until you hit a component
   element (a custom element with a site-specific tag name) that wraps
   exactly the thing you want and nothing more. Hiding the wrapper is almost
   always better than hiding the inner div — the wrapper is more stable and
   it collapses the layout gap too.
3. Test the candidate in the console:
   ```js
   document.querySelectorAll('YOUR_SELECTOR').length
   ```
   Then check you have not over-matched:
   ```js
   $$('YOUR_SELECTOR').forEach(e => e.style.outline = '2px solid red')
   ```
4. Check it on the **other** page types this pack declares in its `pages`
   map. A component used on the home feed is often reused in search or on a
   profile/channel page. If it over-matches, scope it with the registry
   entry's `pages` field rather than making the selector longer — page
   scoping is applied automatically via `html[data-qs-page]`.
5. Check it logged out and in a narrow window. Sites swap components at
   breakpoints and for signed-out users.

## A failure needs investigation, not a rewrite (D14's rule)

Before treating a `0` match as a stale selector, confirm real content exists
on that page for the session you're testing with. A signed-out, history-less
session can legitimately have an empty personalized feed, no ads served in
the session, or no live content for a feature that only applies to streams —
none of that is a redesign. Check with a manual page load first. If the
registry's `verified` field is `'unverified'` or `'needs-account'`, the
automated audit already skips it for exactly this reason — see
`docs/DECISIONS.md` D14.

## Writing the registry entry

Add it to the `features` array in the pack's own file (`src/packs/<id>.js`),
never anywhere else:

```js
{
  id: 'thing_name',           // never change this later; it is a storage key
  group: 'recs',              // one of the pack's own `groups`
  pages: 'watch',             // one of the pack's own `pages` names, or 'all'
  kind: 'css',                // 'js' only if CSS provably cannot do it
  risk: 'low',                // tier 1 → low, tier 2 → med, tier 3 → high
  since: 1,
  verified: 'live',           // 'live' | 'unverified' | 'needs-account'
  label: 'Short UI label',
  desc: 'One line the user reads.',
  sel: ['tag-name-renderer', '#thing.tag-name-renderer'],  // most stable FIRST
  modes: { /* one key per mode this pack declares */ },
}
```

Put two or three selectors in `sel`. They are OR'd together in the generated
CSS and a selector that matches nothing costs nothing — this is cheap
redundancy that buys resilience across A/B variants of the same page.

## Verifying with Playwright

`tests/selectors.spec.js` (YouTube) and each pack's own live selector test
load real pages and assert each `verified: 'live'` selector matches at least
one node. Run the relevant one before and after any selector change:

```bash
npx playwright test tests/selectors.spec.js --project=live --reporter=list
```

Notes for this environment: Chromium is preinstalled at
`/opt/pw-browsers/chromium`; do not run `playwright install`. Being
signed out is enough for most of a pack's selectors; mark the ones that
genuinely require an account `verified: 'needs-account'` rather than
skipping the test file entirely.

## Repairing a broken selector

1. Reproduce: open the page, confirm the element is visible with the toggle on.
2. In the console, run each selector in the entry's `sel` array and find which
   ones return 0.
3. Find the replacement using the process above. **Keep the old selector in
   the array** unless you are sure it is dead everywhere — sites roll changes
   out gradually and some users are still on the old layout for weeks.
4. Downgrade `risk` honestly. If the new selector is tier 3, say so.
5. Add a line to the entry's comment noting the date and what changed.
6. Bump the patch version and note it in `CHANGELOG.md`.

## The health check

`/audit-selectors [pack]` runs a pack's registry selectors against live pages
and prints a table of `id → matched / not matched`. A `not matched` on a
`risk: 'low'` entry is an alarm; on a `risk: 'high'` entry it is expected
maintenance. Run it before every release and whenever a user reports "it
stopped working".

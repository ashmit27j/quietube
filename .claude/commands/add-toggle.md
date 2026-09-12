---
description: Add a new hide/behaviour toggle end-to-end (registry, defaults, handler, test, docs)
---

Add a new toggle to the extension for: **$ARGUMENTS**

Follow this exactly; do not skip steps, and do not edit the options page or the
stylesheet by hand — both are generated from the registry.

1. Read `src/lib/registry.js` and `docs/ARCHITECTURE.md § Adding a feature`.
2. Use the `yt-selector-audit` skill to choose the selector(s). Prefer tier 1
   custom element names; put 2–3 selectors in `sel`, most stable first; set
   `risk` honestly.
3. Decide `kind`:
   - `css` if the goal is "this element should not be visible" — almost always.
   - `js` only if it needs a redirect, a click, or injected UI. Say in your
     summary why CSS could not do it.
4. Add the registry entry in the correct `group` block, with a `desc` written
   for a non-technical user and a default for each of `study` / `music` /
   `casual`. Pick defaults from the mode intents in `docs/SPEC.md` — Music mode
   in particular keeps playlists and related tracks on purpose.
5. If `kind: 'js'`, implement the handler in `src/content/behaviours.js` with
   exactly the name in the `handler` field. It must be idempotent and return a
   cleanup function if it attaches anything.
6. Add a case to `tests/selectors.spec.js`.
7. Regenerate the feature table: `node tools/gen-features.mjs`.
8. Report back: the entry you added, why you chose that selector tier, which
   page types you scoped it to, and anything you could not verify without a
   live browser.

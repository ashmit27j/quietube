---
description: Add a new hide/behaviour toggle end-to-end (registry, defaults, handler, test, docs)
---

Add a new toggle to the extension for: **$ARGUMENTS**

Follow this exactly; do not skip steps, and do not edit the options page or the
stylesheet by hand — both are generated from the registry.

1. Determine the pack (default: `youtube` unless $ARGUMENTS says otherwise).
   Read `src/packs/<pack>.js` and `docs/ARCHITECTURE.md § Adding a feature`.
2. Use the `site-selector-audit` skill to choose the selector(s). Prefer tier 1
   custom element names; put 2–3 selectors in `sel`, most stable first; set
   `risk` honestly, and set `verified` honestly (`'live'` only if you actually
   checked it against the real site this session).
3. Decide `kind`:
   - `css` if the goal is "this element should not be visible" — almost always.
   - `js` only if it needs a redirect, a click, or injected UI. Say in your
     summary why CSS could not do it. Check `core/dom.js`'s `collapseWithReveal`
     first if the behaviour is "collapse behind a button" — don't reimplement it.
4. Add the registry entry in the correct `group` block, with a `desc` written
   for a non-technical user and a default for each mode the pack declares in
   its own `modes` object (for `youtube`: `light` / `music` / `deep_focus`).
   Pick defaults from the mode intents in `docs/SPEC.md` — Music mode in
   particular keeps playlists and related tracks on purpose.
5. If `kind: 'js'`, implement the handler in the pack's own `handlers` object
   (or `core/behaviours.js` only if it is genuinely site-agnostic — see
   `docs/DECISIONS.md` D15) with exactly the name in the `handler` field. It
   must be idempotent and return a cleanup function if it attaches anything.
6. Add a case to the pack's live selector test (`tests/selectors.spec.js` for
   `youtube`; other packs don't have one yet — see `docs/DECISIONS.md` D15/D16).
7. Regenerate the feature table: `node tools/gen-features.mjs` (currently
   YouTube-only).
8. Report back: the entry you added, why you chose that selector tier, which
   page types you scoped it to, and anything you could not verify without a
   live browser.

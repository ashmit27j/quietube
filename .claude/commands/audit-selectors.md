---
description: Check every registry selector against a pack's live site and report which have gone stale
---

Audit the selectors in `src/packs/<pack>.js` against its live site.

1. Load the `site-selector-audit` skill.
2. Determine the pack: use `$ARGUMENTS` if given (e.g. `youtube`, `reddit`),
   otherwise audit every pack in `src/packs/`.
3. For YouTube, run `npx playwright test tests/selectors.spec.js --project=live --reporter=list`.
   Chromium is preinstalled — never run `playwright install`. For any other
   pack without a dedicated live selector test yet, verify each `sel` entry
   by hand against the live site using the skill's process.
4. For any selector matching zero nodes, open the relevant page and find a
   replacement using the skill's process. Keep the old selector in the array
   unless it is dead everywhere; sites roll layouts out gradually. Before
   calling anything stale, confirm real content exists on that page for the
   session used — see the skill's "failure needs investigation" section and
   `docs/DECISIONS.md` D14.
5. Print a table: `id | risk | verified | page | matched? | action taken`.
6. Flag separately, at the top, any `risk: 'low'` or `risk: 'med'` entry that
   failed with real content present — that indicates a real redesign rather
   than routine class churn, and probably means several other selectors are
   about to break too.
7. Do not change `risk` ratings downward to make the report look better. If a
   replacement is a class-name selector, it is `risk: 'high'`.

Scope: $ARGUMENTS (if empty, audit every pack).

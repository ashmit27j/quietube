---
description: Check every registry selector against live YouTube and report which have gone stale
---

Audit the selectors in `src/lib/registry.js` against live YouTube.

1. Load the `yt-selector-audit` skill.
2. Run `npx playwright test tests/selectors.spec.js --reporter=list`. Chromium
   is preinstalled — never run `playwright install`.
3. For any selector matching zero nodes, open the relevant page and find a
   replacement using the skill's process. Keep the old selector in the array
   unless it is dead everywhere; YouTube rolls layouts out gradually.
4. Print a table: `id | risk | page | matched? | action taken`.
5. Flag separately, at the top, any `risk: 'low'` or `risk: 'med'` entry that
   failed — those indicate a real YouTube redesign rather than routine class
   churn, and probably mean several other selectors are about to break too.
6. Do not change `risk` ratings downward to make the report look better. If a
   replacement is a class-name selector, it is `risk: 'high'`.

Scope: $ARGUMENTS (if empty, audit everything).

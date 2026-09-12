---
description: Cut a release — verify, bump, changelog, package, store checklist
---

Cut release **$ARGUMENTS** (semver, e.g. `0.2.0`).

1. Load the `cws-release` skill and work through its pre-flight checklist.
   Report each item as pass/fail; stop and tell me if anything fails rather
   than proceeding.
2. Verify there is no network code:
   `grep -rnE "fetch\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket" src/`
   This must return nothing. If it returns anything, stop.
3. Verify the manifest permissions are still exactly `["storage"]` plus the
   single YouTube host pattern. If they are not, stop and explain what added
   one and whether `DECISIONS.md` and `PRIVACY.md` were updated.
4. Bump `version` in `src/manifest.json`.
5. Write the `CHANGELOG.md` entry: what changed, grouped as Added / Changed /
   Fixed, in user-facing language — this text is reused in the store listing's
   "What's new".
6. Package: zip the **contents** of `src/` (manifest.json at archive root) to
   `dist/quiet-<version>.zip`.
7. Print the final submission checklist from the skill, plus the permission
   justification strings to paste into the dashboard.

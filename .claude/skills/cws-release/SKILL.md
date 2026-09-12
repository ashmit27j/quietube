---
name: cws-release
description: Package and submit this extension to the Chrome Web Store. Use when cutting a release, writing store listing copy, answering the privacy practices form, handling a review rejection, or running /release.
---

# Chrome Web Store release

## Pre-flight

- [ ] `/audit-selectors` run, no `risk: 'low'` or `'med'` entry failing
- [ ] `npx playwright test` green
- [ ] Loaded unpacked, zero console errors on home / watch / search / subs /
      channel / shorts
- [ ] Cold-load screen recording shows no flash of the home feed
- [ ] Version bumped in `src/manifest.json` (semver; the store rejects a
      re-upload at the same version)
- [ ] `CHANGELOG.md` entry
- [ ] Icons present at 16/32/48/128

## Packaging

```bash
cd src && zip -r ../quiet-$(node -p "require('./manifest.json').version").zip . -x '.*' -x '__MACOSX'
```

Zip the **contents** of `src/`, so `manifest.json` is at the root of the
archive. A zip containing a `src/` folder is the most common first rejection.

## Naming and trademark

Google enforces these for YouTube-adjacent extensions:

- The name must **not begin** with "YouTube" and must not be confusable with an
  official Google product.
- "for YouTube" as a suffix is accepted; the ™ symbol is conventional.
- The icon must not use the YouTube logo, its play-button shape, or its red.
- The description must state non-affiliation. Current wording:
  *"Not affiliated with YouTube or Google. YouTube is a trademark of Google LLC."*
- Do not use "official", "premium", or imply a partnership.

Current working name: **Quiet — Distraction Free for YouTube**. Verify it is
not already taken on the store before first submission.

## Privacy practices form

This is where most extensions get stuck. Our answers:

- **Single purpose**: "Hide user-selected parts of the YouTube web interface so
  the user can watch without recommendations, Shorts, comments and other
  distractions."
- **Permission justification — `storage`**: "Stores the user's own toggle
  settings and selected mode. No other data is stored."
- **Permission justification — host permission `*://*.youtube.com/*`**: "The
  extension modifies only the appearance of youtube.com pages. It needs to run
  a content script there to apply the user's hiding preferences."
- **Remote code**: No.
- **Data collection**: declare **none** in every category. This is true — there
  is no network call in the codebase. Verify before submitting:
  ```bash
  grep -rnE "fetch\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket" src/ && echo "FOUND — fix before submitting"
  ```
- A privacy policy URL is required once you declare any data handling; with
  "no data collected" it is still worth linking `docs/PRIVACY.md` hosted on the
  repo.

## Listing assets

Required:
- 128×128 store icon
- at least one 1280×800 or 640×400 screenshot (5 is the practical maximum and
  you should use all 5)
- small promo tile 440×280 (optional but improves placement)

Screenshot plan (in order — the first one is what people actually see):
1. Side-by-side: normal YouTube home vs Quiet study mode.
2. The mode switcher popup.
3. The options page showing the breadth of toggles.
4. Watch page with the sidebar gone and the player widened.
5. A callout: "Free forever. No account. No time limit." — directly addressing
   the DF Tube complaint.

## Description structure

Open with the differentiator, not the category. First two lines are what shows
in search results:

> Hide the YouTube feed, sidebar, Shorts and comments. Free forever — no
> account, no subscription, no daily limit.

Then: mode list, the full toggle list in short bullets, the privacy claim
("nothing leaves your browser; open source"), then the disclaimer.

## Review timelines and rejections

First submission commonly takes several days. Most frequent rejection causes
for this category and how we avoid them:

| Rejection | Avoidance |
|---|---|
| Permissions broader than the single purpose | only `storage` + one host pattern (D5) |
| Misleading name / trademark | see naming rules above |
| Minified or obfuscated code | we ship readable source (D1) |
| Privacy disclosures inconsistent with code | verified by the `grep` above |
| Zip structure wrong | zip the contents of `src/`, not `src/` itself |

On rejection, the email names a specific policy section — quote it in the
`CHANGELOG` entry along with the fix, so the next release does not repeat it.

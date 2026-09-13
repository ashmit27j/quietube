---
name: cws-release
description: Package and submit this extension to the Chrome Web Store. Use when cutting a release, writing store listing copy, answering the privacy practices form, handling a review rejection, or running /release.
---

# Chrome Web Store release

## Pre-flight

- [ ] `/audit-selectors youtube` run, no `risk: 'low'` or `'med'` entry
      failing (Reddit has no live selector test yet — see D15)
- [ ] `npx playwright test` green
- [ ] Loaded unpacked, granted the YouTube pack from the popup, zero console
      errors on home / watch / search / subs / channel / shorts
- [ ] Cold-load screen recording shows no flash of the home feed
- [ ] Confirm `host_permissions` is still `[]` and every pack's host is in
      `optional_host_permissions` — the install prompt should ask for
      nothing beyond the three unprompted permissions (D16)
- [ ] Version bumped in `src/manifest.json` (semver; the store rejects a
      re-upload at the same version)
- [ ] `CHANGELOG.md` entry
- [ ] Icons present at 16/32/48/128 (`npm run gen:brand` if stale)

## Packaging

```bash
cd src && zip -r ../quietsurf-$(node -p "require('./manifest.json').version").zip . -x '.*' -x '__MACOSX'
```

Zip the **contents** of `src/`, so `manifest.json` is at the root of the
archive. A zip containing a `src/` folder is the most common first rejection.

## Naming and trademark

Google enforces these for extensions touching YouTube or Reddit content:

- The name must **not begin** with "YouTube" or "Reddit" and must not be
  confusable with an official product of either.
- The icon must not use the YouTube logo, its play-button shape, or its red
  — nor Reddit's Snoo mascot or its orange. The mark in `brand/` is
  deliberately a wave/ring shape in black and white only, chosen for this
  reason (see the brief in `tools/gen-brand.mjs`).
- The description must state non-affiliation with every site supported.
  Current wording: *"Not affiliated with YouTube, Google, Reddit, or any
  site this extension supports."*
- Do not use "official", "premium", or imply a partnership with any of them.

Name: **QuietSurf**. Verify it is not already taken on the store before
first submission. The repo and its GitHub URL stay `quietube` — a
deliberate choice, not an oversight (the maintainer's call, not this skill's).

## Privacy practices form

This is where most extensions get stuck. Our answers:

- **Single purpose**: "Hide user-selected distracting parts of supported
  sites' web interfaces (currently YouTube and Reddit), per site and per user
  preference."
- **Permission justification — `storage`**: "Stores the user's own toggle
  settings and selected mode, per site. No other data is stored."
- **Permission justification — `scripting`**: "Lets a site's hiding rules
  start applying immediately after the user grants that site, instead of
  waiting for a tab reload or browser restart. Only used for sites the user
  has already approved."
- **Permission justification — `activeTab`**: "Lets the popup show the
  right view (mode picker vs. an unsupported-site message) for whichever tab
  the user has open when they click the extension icon. Silent — no
  install-time prompt — active only for that tab, only while the popup is open."
- **Permission justification — each optional host permission**: "Requested
  only when the user turns on that site's pack. The extension modifies only
  the appearance of that site's pages." `host_permissions` is empty at
  install — see `docs/DECISIONS.md` D16 and keep `store/LISTING.md`'s
  "Permission justifications" table in sync with whatever
  `optional_host_permissions` currently lists.
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
1. Side-by-side: normal YouTube home vs QuietSurf Deep Focus mode.
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
| Permissions broader than the single purpose | `storage` + `scripting` + `activeTab` (the last two are unprompted/silent), zero host permissions at install, one optional host pattern per pack requested on first use (D16) |
| Misleading name / trademark | see naming rules above |
| Minified or obfuscated code | we ship readable source (D1) |
| Privacy disclosures inconsistent with code | verified by the `grep` above |
| Zip structure wrong | zip the contents of `src/`, not `src/` itself |

On rejection, the email names a specific policy section — quote it in the
`CHANGELOG` entry along with the fix, so the next release does not repeat it.

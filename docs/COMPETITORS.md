# Competitive landscape

Researched 2026-09-12. Re-check before the store listing is written — these
move.

## DF Tube New (Distraction Free for YouTube™)
`kchgllkpfcggmdaoopkhlkbcokngahlg` · focusapps.app

- ~20,000 users · **3.56/5** from 232 reviews · v1.21.2, updated 2026-05-21
- Permissions: `storage`, `tabs`, `notifications`, content script on
  www.youtube.com
- Features: disable autoplay, hide recommendations/suggestions, hide homepage
  grid; optional hide Shorts, block comments, disable playlists
- **Monetisation: subscription, with a one-hour daily usage limit on the free
  tier.** This is the core of the opportunity — the rating collapse and the
  review content both trace to it, and reviewers name Unhook and FocusTube as
  the replacements they moved to.
- Note: this is a newer listing (created Nov 2024) trading on the reputation of
  the original **DF YouTube** by RickyV — 4.6/5, ~9,600 Firefox users, free,
  but last updated 2019 and effectively abandoned. Users conflate the two,
  which is part of why the reviews are angry.

## Unhook
The main free competitor, and the real bar to clear.

- ~20 toggles, no account required
- Covers: homepage feed, sidebar/related, Shorts feed and shelf, comments
  (incl. avatars), Explore/Trending, end-of-video wall and cards, "related to
  your search" / "people also search for", mix playlists, merch/tickets/offers,
  share/like/dislike, channel info and subscribe button, description, autoplay,
  annotations, notification bell, subscriptions feed (with redirect), live chat
- Gaps we exploit: no modes or presets, no scheduling, no peek, Shorts URLs
  still open the swipe feed, no grayscale/text-only, flash of feed on cold
  load, no import/export

## FocusTube
Named repeatedly in DF Tube reviews as an alternative. Worth installing and
diffing before the listing copy is finalised.

## Where QuietSurf lands

More toggles than Unhook, more capability than paid DF Tube, and three things
nobody has (modes, scheduling, peek) plus a real Shorts kill. The pitch writes
itself: *everything DF Tube charges for, free, plus the things neither of them
built.*

None of the above — nor any other distraction-blocker we've looked at —
targets more than one site. Each is a single-site extension with a single
permission story baked into its architecture; adding a second site would mean
a second extension, a second listing, a second update cycle. QuietSurf's
core/pack split (`docs/ARCHITECTURE.md`) makes a second site a ~600-line pack
file and a manifest entry, not a rewrite — and D16's opt-in-per-site
permission model means adding pack seven costs the *user* nothing they didn't
already agree to for pack one. That's the second positioning claim, not just
the YouTube one: *the only tool in this category that scales past one site
without asking for everything up front.*

## Sources

- [DF Tube on chrome-stats](https://chrome-stats.com/d/kchgllkpfcggmdaoopkhlkbcokngahlg)
- [DF Tube on the Chrome Web Store](https://chromewebstore.google.com/detail/df-tube-new-distraction-f/kchgllkpfcggmdaoopkhlkbcokngahlg)
- [Unhook features page](https://unhookextension.com/features)
- [DF YouTube (original, Firefox)](https://addons.mozilla.org/en-US/firefox/addon/df-youtube/)

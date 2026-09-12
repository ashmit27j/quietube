# Chrome Web Store listing copy

Paste-ready. Keep in sync with `CHANGELOG.md` and the manifest description.

---

## Name (45 char max)

```
Quiet — Distraction Free for YouTube
```

*Verify availability before submitting. Must not begin with "YouTube"; must not
imply affiliation. See `.claude/skills/cws-release`.*

## Short description (132 char max)

```
Hide the YouTube feed, sidebar, Shorts and comments. 40+ toggles, switchable modes. Free forever — no account, no time limit.
```

## Category

Productivity → Workflow & Planning

## Full description

```
Quiet removes the parts of YouTube that keep you there longer than you meant to stay.

Free forever. No account. No subscription. No daily time limit. Nothing leaves your browser.

━━ MODES, NOT A MASTER SWITCH ━━

Most blockers make you choose between "focused" and "normal" — so the first time you need a recommendation, you disable the extension and never turn it back on. Quiet has modes instead:

• Casual — recommendations and Shorts gone, comments collapsed, the rest of YouTube intact
• Music — playlists, mixes and related tracks deliberately stay. Visual noise, comments and Shorts go.
• Study — search and watch only. Home feed replaced with a prompt, sidebar gone, thumbnails in grayscale.
• Custom — your own set of toggles.

Switch with one click, or cycle with Alt+Shift+Q. Set a schedule so Study mode turns itself on during work hours.

And when you genuinely need to see something: press Alt+Shift+P to Peek. Everything comes back for 30 seconds, then hides itself again. You never have to disable the extension.

━━ SHORTS, ACTUALLY GONE ━━

Other extensions hide the Shorts shelves — but a /shorts/ link from a friend still opens the swipe feed, and one swipe later you're gone. Quiet opens those links in the normal player instead. The link still works. The feed never loads.

Plus the shelves, the sidebar entry, Shorts in search, the channel tab, and Shorts in your subscriptions.

━━ 40+ THINGS YOU CAN HIDE ━━

Home feed and topic chips · subscriptions feed · watch-page sidebar · end-of-video wall · in-video cards and annotations · "people also search for" · auto-generated mixes · all playlists · every Shorts entry point · comments (hide, or collapse behind a button) · commenter avatars · live chat · autoplay · ambient mode · view counts · like counts · merch, tickets and offers · video descriptions · subscribe and join buttons · left sidebar · Explore and Trending · notification bell · search autocomplete · promoted results · "for you" shelves in search · and more.

Two you won't find anywhere else: grayscale thumbnails, which takes most of the pull out of clickbait, and pause-on-tab-switch, so a video can't keep playing while you work.

━━ NO FLASH ━━

Every other blocker shows you the full homepage for a split second before hiding it. Quiet applies your settings before the page paints. You never see the feed.

━━ PRIVACY ━━

One permission: storage, to save your settings. Access to youtube.com only.

No analytics. No telemetry. No account. No server. There is not a single network request in the code, and the source is public and unminified so you can check that yourself.

Settings sync between your own Chrome profiles using Chrome's built-in sync. Export and import them as a file any time.

━━ OPEN SOURCE ━━

MIT licensed. Issues and pull requests welcome.

—

Not affiliated with YouTube or Google. YouTube is a trademark of Google LLC.
```

## Permission justifications

| Field | Text |
|---|---|
| Single purpose | Hide user-selected parts of the YouTube web interface so the user can watch without recommendations, Shorts, comments and other distractions. |
| `storage` | Stores the user's own toggle settings and selected mode. No other data is stored. |
| Host permission `*://*.youtube.com/*` | The extension modifies only the appearance of youtube.com pages. It needs a content script there to apply the user's hiding preferences. |
| Remote code | No. All code is included in the package. |
| Data collection | None, in every category. |

## Screenshots (1280×800) — shoot in this order

1. **Side by side**: default YouTube home vs Quiet Study mode. This is the thumbnail; it has to land in one glance.
2. **Popup open** over a watch page, showing the mode buttons.
3. **Options page**, scrolled to show the breadth of toggles.
4. **Watch page**, sidebar gone, player widened.
5. **Text callout**: "Free forever. No account. No daily limit." — speaks directly to what DF Tube users are searching for.

## Assets checklist

- [ ] 128×128 store icon (`src/icons/128.png`)
- [ ] 5 screenshots at 1280×800
- [ ] 440×280 small promo tile (`store/promo-440x280.png` is a placeholder — redo with real typography)
- [ ] Privacy policy URL (host `docs/PRIVACY.md` from the repo)

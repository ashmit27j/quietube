# Chrome Web Store listing copy

Paste-ready. Keep in sync with `CHANGELOG.md` and the manifest description.

---

## Name (45 char max)

```
QuietSurf
```

*Verify availability before submitting. Must not begin with "YouTube" or
"Reddit"; must not imply affiliation with either. See `.claude/skills/cws-release`.*

## Short description (132 char max)

```
Hide the distracting parts of YouTube, Reddit and more. Per-site toggles, switchable modes. Free forever — no account.
```

## Category

Productivity → Workflow & Planning

## Full description

```
QuietSurf removes the parts of the sites you use that keep you there longer than you meant to stay — one site at a time, on your terms.

Free forever. No account. No subscription. No daily time limit. Nothing leaves your browser.

━━ ONE SITE AT A TIME, NOTHING GRANTED UP FRONT ━━

Install asks for nothing. The first time you turn a site on — from the popup, in one click — Chrome asks you to approve that site alone. Don't use QuietSurf on Reddit? It never touches Reddit, and never asked to.

━━ MODES, NOT A MASTER SWITCH ━━

Most blockers make you choose between "focused" and "normal" — so the first time you need a recommendation, you disable the extension and never turn it back on. QuietSurf has modes instead:

• Light — the noisiest stuff gone, the rest of the site intact
• Deep Focus — search-and-read/watch only
• Custom — your own set of toggles
• YouTube also gets Music — playlists, mixes and related tracks deliberately stay. Visual noise, comments and Shorts go.

Switch with one click, or cycle YouTube's with Alt+Shift+Q. Set a schedule so Deep Focus turns itself on during work hours.

And when you genuinely need to see something: press Alt+Shift+P to Peek. Everything comes back for 30 seconds, then hides itself again. You never have to disable the extension.

━━ YOUTUBE: SHORTS, ACTUALLY GONE ━━

Other extensions hide the Shorts shelves — but a /shorts/ link from a friend still opens the swipe feed, and one swipe later you're gone. QuietSurf opens those links in the normal player instead. The link still works. The feed never loads.

Plus the shelves, the sidebar entry, Shorts in search, the channel tab, and Shorts in your subscriptions.

━━ 41 THINGS YOU CAN HIDE ON YOUTUBE, 6 ON REDDIT (AND COUNTING) ━━

YouTube: home feed and topic chips · subscriptions feed · watch-page sidebar · end-of-video wall · in-video cards and annotations · "people also search for" · auto-generated mixes · all playlists · every Shorts entry point · comments (hide, or collapse behind a button) · commenter avatars · live chat · autoplay · ambient mode · view counts · like counts · merch, tickets and offers · video descriptions · subscribe and join buttons · left sidebar · Explore and Trending · notification bell · search autocomplete · promoted results · "for you" shelves in search · and more.

Reddit: promoted posts · recommended-community cards · Trending Today & Popular Communities · the whole right sidebar · award & coin prompts · comment collapse.

Two you won't find anywhere else: grayscale thumbnails, which takes most of the pull out of clickbait, and pause-on-tab-switch, so a video can't keep playing while you work.

━━ NO FLASH ━━

Every other blocker shows you the full page for a split second before hiding it. QuietSurf applies your settings before the page paints. You never see the feed.

━━ PRIVACY ━━

Installs with zero site access. Turning on a site for the first time asks Chrome's own permission prompt for that site, and only that site — nothing is granted up front.

No analytics. No telemetry. No account. No server. There is not a single network request in the code, and the source is public and unminified so you can check that yourself.

Settings sync between your own Chrome profiles using Chrome's built-in sync. Export and import them as a file any time.

━━ OPEN SOURCE ━━

MIT licensed. Issues and pull requests welcome — including a pull request adding a pack for your favourite site.

—

Not affiliated with YouTube, Google, Reddit, or any site this extension supports.
```

## Permission justifications

D16 moved every site to an optional, requested-on-first-use host permission
— `host_permissions` is empty at install, and both site permissions below
are `optional_host_permissions`.

| Field | Text |
|---|---|
| Single purpose | Hide user-selected distracting parts of supported sites' web interfaces (currently YouTube and Reddit), per site and per user preference. |
| `storage` | Stores the user's own toggle settings and selected mode, per site. No other data is stored. |
| `scripting` | Lets a site's hiding rules start applying immediately after the user grants that site, instead of waiting for a tab reload or browser restart. Only used for sites the user has already been asked about and approved. |
| `activeTab` | Lets the popup show the right view (mode picker vs. "no pack for this site") for whichever tab the user has open when they click the extension icon. Silent permission — no install-time prompt — and only active for that one tab while the popup is open. |
| Optional host permission `*://*.youtube.com/*` | Requested only when the user turns on the YouTube pack. The extension modifies only the appearance of youtube.com pages. |
| Optional host permission `*://*.reddit.com/*` | Requested only when the user turns on the Reddit pack. The extension modifies only the appearance of reddit.com pages. |
| Remote code | No. All code is included in the package. |
| Data collection | None, in every category. |

## Screenshots (1280×800) — shoot in this order

1. **Side by side**: default YouTube home vs QuietSurf Deep Focus mode. This is the thumbnail; it has to land in one glance.
2. **Popup open** over a watch page, showing the mode buttons and quick toggles.
3. **Options page**, scrolled to show both site cards and the breadth of toggles.
4. **Watch page**, sidebar gone, player widened.
5. **Text callout**: "Free forever. No account. Nothing granted until you say so." — leads with the permission story, which is the thing no competitor can copy without a rewrite.

## Assets checklist

- [ ] 128×128 store icon (`src/icons/128.png`, from `npm run gen:brand`)
- [ ] 5 screenshots at 1280×800
- [ ] 440×280 small promo tile (`store/promo-440x280.png`, from `npm run gen:brand`)
- [ ] Privacy policy URL (host `docs/PRIVACY.md` from the repo)

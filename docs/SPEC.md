# QuietSurf — product spec

## The product

QuietSurf is a site-agnostic core engine plus a **pack** per site — a pack's
own registry, handlers, pages and modes, nothing else touched. Nothing is
granted at install; each site is opt-in, requested the first time a user
turns it on (see `docs/DECISIONS.md` D16). YouTube is the first pack and the
reason the project exists at all — its opportunity, positioning and feature
parity work below still describe it specifically — but it is a pack, not a
special case, and every claim in this document about "modes", "no flash", or
"a real permission story" is a claim about the *engine*, true for any pack.

## YouTube pack

### The opportunity

DF Tube has ~20,000 users and a **3.56/5** rating across 232 reviews. Its
feature set is small (7 core toggles) and it was free for years. It then
introduced a subscription with a **one-hour daily usage limit** on the free
tier, and the rating collapsed — reviews now mostly say "was great, now
paywalled" and name Unhook and FocusTube as replacements.

That is a userbase actively looking to leave, with a clear reason. The gap is
not "another blocker" — Unhook already does the basics free and does them well.
The gap is:

1. A free tool that is *more* capable than the paid one, not merely cheaper.
2. Granularity without an all-or-nothing switch. Every existing tool makes you
   choose between "focused" and "normal" by disabling the extension; nobody
   ships **modes**.
3. Resilience. Every one of these extensions silently breaks for weeks after a
   YouTube redesign, because their selectors are scattered through the code and
   nobody notices which one died.

### Positioning

> Everything DF Tube gates behind a subscription, free forever — plus modes,
> a real Shorts kill, and no flash of the feed before it hides.

Three claims that are literally true and that no competitor can match today:

| Claim | Why it holds |
|---|---|
| **No paywall, no account, no time limit** | DF Tube's #1 complaint. We never add one. |
| **Modes, not a master switch** | Deep Focus / Music / Light, hotkey-cycled, optionally scheduled. |
| **No flash of the feed** | Synchronous localStorage-cached CSS at `document_start`. See ARCHITECTURE. |

Plus two permission/trust claims: nothing is granted up front (`docs/DECISIONS.md`
D16 — DF Tube asks for `tabs` and `notifications` unconditionally), and open
source with zero network calls.

### Feature parity matrix

| | DF Tube (free) | DF Tube (paid) | Unhook | **QuietSurf** |
|---|---|---|---|---|
| Hide homepage grid | ✓ (1h/day) | ✓ | ✓ | ✓ |
| Hide sidebar recommendations | ✓ (1h/day) | ✓ | ✓ | ✓ |
| Disable autoplay | ✓ (1h/day) | ✓ | ✓ | ✓ |
| Hide comments | — | ✓ | ✓ | ✓ + **collapse-behind-button** |
| Hide Shorts shelves | — | ✓ | ✓ | ✓ |
| **Redirect /shorts/ → /watch** | — | — | — | **✓** |
| Hide playlists sitewide | — | ✓ | — | ✓ |
| End-of-video wall | ✓ | ✓ | ✓ | ✓ |
| Live chat | — | ✓ | ✓ | ✓ |
| Merch / tickets | — | — | ✓ | ✓ |
| Search shelves & promoted results | — | — | partial | ✓ |
| **Modes / presets** | — | — | — | **✓** |
| **Scheduled auto-switching** | — | — | — | **✓** |
| **Peek (30s reveal hotkey)** | — | — | — | **✓** |
| **Grayscale thumbnails** | — | — | — | **✓** |
| **Pause on tab blur** | — | — | — | **✓** |
| Import / export settings | — | — | — | ✓ |
| Sync across devices | — | ✓ | ✓ | ✓ (`storage.sync`) |
| Permissions requested up front | storage, tabs, notifications | same | storage | **none — opt-in per site (D16)** |
| Also works beyond YouTube | — | — | — | **✓ (Reddit pack, more to come)** |
| Price | 1h/day free | subscription | free | **free** |

Toggle count: DF Tube 7, Unhook ~20, **QuietSurf's YouTube pack 41** (see
`FEATURES.md`).

### The differentiators, in detail

#### Modes
Four presets plus custom:

- **Off** — extension does nothing.
- **Light** — recommendations and Shorts gone, comments collapsed, everything
  else normal. The "I still want YouTube to be YouTube" setting. (Named
  `casual` originally; renamed to the generic mode name every pack shares —
  see D17.)
- **Music** — playlists, mixes and related tracks deliberately *stay*; visual
  noise, comments and Shorts go. Existing tools break music listening because
  they treat "related video" as always-bad. YouTube-pack-only: a mode with no
  generic equivalent, not forced onto other packs.
- **Deep Focus** — search-and-watch only. Home feed replaced by a prompt, left
  rail gone, thumbnails grayscale. (Named `study` originally; see D17.)
- **Custom** — the user's own set.

Modes are switched from the popup or by cycling with `Alt+Shift+Q`. Any
individual toggle the user flips becomes an **override** that layers on top of
whatever mode is active, so customising one thing does not drop you out of the
preset system. This is the design that makes 40 toggles usable instead of
overwhelming.

**Scheduling**: rules of the shape *(days, from, to, mode)*. A matching rule
beats the manually selected mode. Deep Focus 09:00–17:00 on weekdays is the
motivating case.

**Peek**: `Alt+Shift+P` reveals everything for 30 seconds, then it re-hides
itself. This exists because the observed failure mode of every blocker is
*"I needed the sidebar once, so I disabled the extension, and never re-enabled
it."* A time-boxed escape hatch keeps people installed.

#### Real Shorts removal
Competitors hide Shorts *shelves*. A `/shorts/` link from a friend still opens
the swipe feed, and one swipe later you are gone. The YouTube pack rewrites
`youtube.com/shorts/ID` → `youtube.com/watch?v=ID` before the Shorts player
boots, so the link still works and the feed never exists. Plus the shelf, the
nav entry, the search results, the channel tab and the subscriptions rows.

## Reddit pack

The second pack, added specifically to prove the core/pack split actually
generalises rather than being YouTube's structure wearing a costume. Six
starting toggles (promoted posts, recommended-community cards, the
Trending/Popular sidebar module, the whole right sidebar, award/coin
prompts, comment collapse) using the generic `light`/`deep_focus` mode names.
Its selectors are `verified: 'unverified'` pending a live audit from a
network that can reach reddit.com — see `docs/DECISIONS.md` D15 for what was
found building it, including the one core/pack boundary correction it
surfaced (`collapseWithReveal` moving into `core/dom.js`).

## Non-goals for v1

- Firefox / Safari ports (the code is portable; ship Chrome first).
- Per-channel allow/deny rules — designed in `ROADMAP.md`, deliberately v2.
- Time tracking and stats — it is a second data model and a second privacy
  conversation. v2.
- Anything that touches ads. Stay out of that fight; it is a different review
  category and a different legal posture.
- Any server, account, or sync of our own.
- A pack store / marketplace, or any mechanism for loading a pack QuietSurf
  didn't ship with. Packs are reviewed and shipped in this repo, full stop.

## Success criteria for v1

- The YouTube pack loads unpacked with zero console errors on home, watch,
  search, subs, channel and shorts pages, once its permission is granted.
- No visible flash of the home feed on a cold load (verify with a throttled
  profile and a screen recording).
- Every `risk: 'low'` and `risk: 'med'` YouTube selector matches at least one
  node on a real page in `tests/selectors.spec.js`.
- Passes Chrome Web Store review with `storage` + `scripting` + `activeTab`
  and zero host permissions granted at install (D16).

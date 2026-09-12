# Feature reference

Generated from `src/lib/registry.js` by `tools/gen-features.mjs`.
**Do not edit by hand** — edit the registry and regenerate.

41 toggles across 9 groups.

Columns: **S** = Study mode default, **M** = Music, **C** = Casual.
**Risk** is selector fragility — `high` means it depends on a YouTube class
name and should be checked first after a redesign.

## Home & feeds

_The infinite grid that starts every doomscroll._

| Toggle | id | Page | Kind | Risk | S | M | C | What it does |
|---|---|---|---|---|:-:|:-:|:-:|---|
| Homepage video grid | `home_feed` | home | css | low | ✓ | ✓ | ✓ | Replaces the recommendation wall with an empty, calm page. |
| Topic filter chips | `home_chips` | home | css | low | ✓ | · | ✓ | The "All / Music / Gaming / Live" bar above the grid. |
| Show a calm placeholder | `home_placeholder` | home | js | low | ✓ | · | · | Puts a search box and your own message where the feed was, instead of blank space. |
| Subscriptions feed | `subs_feed` | subs | css | low | · | · | · | Hides the subscriptions grid too. Most people want this ON for study, OFF otherwise. |
| Redirect home → subscriptions | `redirect_home_to_subs` | home | js | low | · | · | · | Opening youtube.com lands on your subscriptions instead of the algorithm. |
| Promoted / masthead units | `home_ads` | all | css | med | ✓ | ✓ | ✓ | In-feed promoted videos and the top banner slot. |

## Recommendations

_Sidebar, end screens, and in-video nudges._

| Toggle | id | Page | Kind | Risk | S | M | C | What it does |
|---|---|---|---|---|:-:|:-:|:-:|---|
| Watch-page sidebar | `watch_sidebar` | watch | css | low | ✓ | ✓ | ✓ | The "up next" column. The single highest-value toggle in the extension. |
| Widen player into the gap | `watch_sidebar_widen` | watch | css | med | ✓ | ✓ | ✓ | Without this, hiding the sidebar leaves an ugly empty column. |
| End-of-video wall | `endscreen` | watch | css | med | ✓ | ✓ | ✓ | The grid of thumbnails that covers the video the second it ends. |
| In-video cards & annotations | `info_cards` | watch | css | med | ✓ | ✓ | ✓ | The little "i" teaser that pops out mid-video. |
| "People also search for" | `related_to_search` | search | css | med | ✓ | · | ✓ | The lateral-drift shelves injected into search results. |
| Auto-generated mixes | `mixes` | all | css | med | ✓ | · | ✓ | Endless algorithmic "Mix — YouTube" playlists. Keep OFF in Music mode. |
| All playlists sitewide | `playlists_sitewide` | all | css | low | · | · | · | DF Tube parity option. Aggressive — most people leave this off. |

## Shorts

_Every entry point, not just the shelf._

| Toggle | id | Page | Kind | Risk | S | M | C | What it does |
|---|---|---|---|---|:-:|:-:|:-:|---|
| Redirect Shorts → normal player | `shorts_redirect` | shorts | js | low | ✓ | ✓ | ✓ | youtube.com/shorts/ID becomes youtube.com/watch?v=ID. Kills the swipe feed dead while still letting links you were sent actually open. |
| Shorts shelves | `shorts_shelf` | all | css | low | ✓ | ✓ | ✓ | The horizontal Shorts rows wherever they appear. |
| Shorts link in the left rail | `shorts_nav` | all | css | med | ✓ | ✓ | ✓ | Removes the entry point from the guide and the mini-guide. |
| Shorts in search results | `shorts_search` | search | css | med | ✓ | ✓ | ✓ | Search returns videos only. |
| Shorts tab on channels | `shorts_channel_tab` | channel | css | **high** | ✓ | · | · | Hides the Shorts tab from channel pages. |
| Shorts in subscriptions | `shorts_subs` | subs | css | med | ✓ | ✓ | ✓ | Keeps the subs feed to long-form only. |

## Comments & chat

_Hide outright, or collapse behind one click._

| Toggle | id | Page | Kind | Risk | S | M | C | What it does |
|---|---|---|---|---|:-:|:-:|:-:|---|
| Collapse comments behind a button | `comments_collapse` | watch | js | low | ✓ | · | ✓ | Better than hiding: you keep access, you just stop falling in. Mutually exclusive with the next toggle. |
| Hide comments completely | `comments_hide` | watch | css | low | · | · | · | No button, no comments. |
| Commenter profile pictures | `comment_avatars` | watch | css | med | · | · | · | Lowers the visual noise if you keep comments on. |
| Live chat panel | `live_chat` | watch | css | low | ✓ | ✓ | · | Hides chat on live streams and premieres. |

## Player behaviour

_Autoplay, ambient mode, end cards._

| Toggle | id | Page | Kind | Risk | S | M | C | What it does |
|---|---|---|---|---|:-:|:-:|:-:|---|
| Force autoplay off | `autoplay_off` | watch | js | med | ✓ | · | ✓ | Flips the player toggle and re-flips it whenever YouTube turns it back on. |
| Disable ambient mode | `ambient_off` | watch | js | med | ✓ | · | · | Stops the coloured glow bleeding out of the player. |
| Pause when you switch tabs | `pause_on_blur` | watch | js | low | · | · | · | Nobody else has this. Stops the "video kept playing while I worked" trap. |

## Social pressure

_Counts, badges, and buy-buttons._

| Toggle | id | Page | Kind | Risk | S | M | C | What it does |
|---|---|---|---|---|:-:|:-:|:-:|---|
| View counts | `view_count` | watch | css | **high** | · | · | · | Judge the video, not its popularity. |
| Like counts | `like_counts` | watch | css | **high** | · | · | · | Keeps the button, hides the number. |
| Merch, tickets & offers | `merch_shelf` | watch | css | low | ✓ | ✓ | ✓ | Product shelves under the player. |
| Video description | `description` | watch | css | low | · | · | · | Link farms and sponsor blocks. |
| Subscribe / Join buttons | `subscribe_button` | watch | css | med | · | · | · | Removes the conversion prompts. |

## Navigation & chrome

_Left rail, notifications, search extras._

| Toggle | id | Page | Kind | Risk | S | M | C | What it does |
|---|---|---|---|---|:-:|:-:|:-:|---|
| Left sidebar | `guide_rail` | all | css | low | ✓ | · | · | The whole navigation rail, including Explore and Trending. |
| Explore & Trending entries | `explore_trending` | all | css | med | ✓ | ✓ | ✓ | Keeps the rail but drops the discovery entries. |
| Notification bell | `notification_bell` | all | css | med | ✓ | ✓ | ✓ | Removes the red-dot pull. |
| Search autocomplete | `search_suggestions` | all | css | **high** | · | · | · | Search for what you came for, not what it suggests. |
| Voice search button | `voice_search` | all | css | low | · | · | · | Minor, but it is one less thing. |

## Search results

_Keep search a tool, not a feed._

| Toggle | id | Page | Kind | Risk | S | M | C | What it does |
|---|---|---|---|---|:-:|:-:|:-:|---|
| "For you" shelves in search | `search_shelves` | search | css | med | ✓ | · | · | Injected recommendation rows between real results. |
| Promoted search results | `search_ads` | search | css | med | ✓ | ✓ | ✓ | Ad slots at the top of results. |

## Visual calm

_Blunt-instrument options that defeat thumbnail bait._

| Toggle | id | Page | Kind | Risk | S | M | C | What it does |
|---|---|---|---|---|:-:|:-:|:-:|---|
| Grayscale thumbnails | `grayscale_thumbs` | all | css | low | ✓ | · | · | Nobody ships this and it works disturbingly well — clickbait thumbnails lose most of their pull in black and white. |
| Text-only mode | `hide_thumbs` | all | css | low | · | · | · | Hides every thumbnail. Titles only, everywhere. |
| Reduce contrast of chrome | `dim_ui` | all | css | low | · | · | · | Fades non-content UI so the video is the brightest thing on screen. |

## Modes

- **Off** — Extension does nothing. Normal YouTube.
- **Casual** — Kills the worst of it. Recommendations gone, comments collapsed.
- **Music** — Playlists, mixes and related tracks stay. Visual noise goes.
- **Study** — Search-and-watch only. Everything else is gone.
- **Custom** — Your own set of toggles.

## Selector inventory

Every selector the extension uses, for audit purposes.

| id | risk | selectors |
|---|---|---|
| `home_feed` | low | `ytd-browse[page-subtype="home"] ytd-rich-grid-renderer` |
| `home_chips` | low | `ytd-browse[page-subtype="home"] #chips-wrapper`<br>`ytd-feed-filter-chip-bar-renderer` |
| `subs_feed` | low | `ytd-browse[page-subtype="subscriptions"] ytd-rich-grid-renderer` |
| `home_ads` | med | `ytd-rich-section-renderer:has(ytd-statement-banner-renderer)`<br>`ytd-display-ad-renderer`<br>`ytd-ad-slot-renderer`<br>`ytd-in-feed-ad-layout-renderer` |
| `watch_sidebar` | low | `#secondary.ytd-watch-flexy`<br>`#related` |
| `endscreen` | med | `.ytp-endscreen-content`<br>`.html5-endscreen`<br>`.ytp-ce-video`<br>`.ytp-ce-playlist` |
| `info_cards` | med | `.ytp-cards-teaser`<br>`.ytp-ce-element`<br>`.iv-branding`<br>`.annotation` |
| `related_to_search` | med | `ytd-horizontal-card-list-renderer`<br>`ytd-shelf-renderer:has(#title-text)` |
| `mixes` | med | `ytd-radio-renderer`<br>`ytd-compact-radio-renderer` |
| `playlists_sitewide` | low | `ytd-playlist-renderer`<br>`ytd-compact-playlist-renderer`<br>`ytd-playlist-panel-renderer` |
| `shorts_shelf` | low | `ytd-rich-shelf-renderer[is-shorts]`<br>`ytd-reel-shelf-renderer`<br>`ytm-shorts-lockup-view-model` |
| `shorts_nav` | med | `ytd-guide-entry-renderer:has(a[title="Shorts"])`<br>`ytd-mini-guide-entry-renderer[aria-label="Shorts"]` |
| `shorts_search` | med | `ytd-video-renderer:has(a[href^="/shorts/"])`<br>`ytd-reel-shelf-renderer` |
| `shorts_channel_tab` | high | `yt-tab-shape[tab-title="Shorts"]`<br>`tp-yt-paper-tab:has(a[href$="/shorts"])` |
| `shorts_subs` | med | `ytd-browse[page-subtype="subscriptions"] ytd-rich-shelf-renderer[is-shorts]` |
| `comments_hide` | low | `ytd-comments#comments`<br>`#comments` |
| `comment_avatars` | med | `ytd-comment-view-model #author-thumbnail`<br>`#author-thumbnail.ytd-comment-view-model` |
| `live_chat` | low | `ytd-live-chat-frame#chat`<br>`#chat-container` |
| `view_count` | high | `ytd-watch-metadata #info span.view-count`<br>`#info-container .view-count` |
| `like_counts` | high | `ytd-watch-metadata like-button-view-model .yt-spec-button-shape-next__button-text-content` |
| `merch_shelf` | low | `ytd-merch-shelf-renderer`<br>`ytd-ticket-shelf-renderer`<br>`#offer-module` |
| `description` | low | `ytd-watch-metadata #description-inner`<br>`#description.ytd-watch-metadata` |
| `subscribe_button` | med | `ytd-watch-metadata #subscribe-button`<br>`ytd-watch-metadata #sponsor-button` |
| `guide_rail` | low | `ytd-app #guide`<br>`tp-yt-app-drawer#guide` |
| `explore_trending` | med | `ytd-guide-entry-renderer:has(a[title="Trending"])`<br>`ytd-guide-entry-renderer:has(a[title="Explore"])` |
| `notification_bell` | med | `ytd-notification-topbar-button-renderer` |
| `search_suggestions` | high | `.ytSuggestionComponentSuggestionsContainer`<br>`ytd-searchbox #suggestions` |
| `voice_search` | low | `#voice-search-button` |
| `search_shelves` | med | `ytd-shelf-renderer`<br>`ytd-universal-watch-card-renderer` |
| `search_ads` | med | `ytd-search-pyv-renderer`<br>`ytd-promoted-sparkles-text-search-renderer` |
| `grayscale_thumbs` | low | `ytd-thumbnail img`<br>`yt-image img` |
| `hide_thumbs` | low | `ytd-thumbnail`<br>`ytd-playlist-thumbnail` |
| `dim_ui` | low | `#masthead-container` |

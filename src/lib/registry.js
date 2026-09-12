/**
 * FEATURE REGISTRY — the single source of truth for the whole extension.
 *
 * Everything else is generated from this file:
 *   - the options page UI (grouped, labelled, described)
 *   - the injected stylesheet (css features)
 *   - the behaviour handlers dispatch table (js features)
 *   - the default values for each built-in mode
 *   - the selector health self-test
 *
 * NEVER hardcode a YouTube selector anywhere else in the codebase.
 * When YouTube ships a layout change, this is the only file that changes.
 *
 * ── Field reference ───────────────────────────────────────────────────────
 *  id        stable key, also the chrome.storage key. Never rename (migrate instead).
 *  group     options-page section. See GROUPS below.
 *  label     short UI label.
 *  desc      one line shown under the label.
 *  kind      'css'  → hidden purely with CSS (preferred: survives SPA re-renders)
 *            'js'   → needs a behaviour handler in src/content/behaviours.js
 *            'both' → CSS hides it, JS does something extra (e.g. redirect)
 *  sel       array of selectors, ordered MOST STABLE FIRST.
 *            Tier 1: custom element tag names (ytd-*, yt-*) — YouTube rarely renames these
 *            Tier 2: [attribute] / id selectors — fairly stable
 *            Tier 3: .class names — churn constantly, last resort only
 *            All selectors in the array are applied; extras are harmless if absent.
 *  pages     which URL shapes this applies to (used by the health check + docs):
 *            'home' | 'watch' | 'search' | 'subs' | 'channel' | 'shorts' | 'all'
 *  handler   for kind 'js'/'both', the export name in behaviours.js
 *  modes     default value per built-in mode. Keys: study, music, casual
 *  style     true → this feature is NOT display:none. Its visual treatment is a
 *            hand-written rule in css-engine.js (a filter, an opacity, a layout
 *            change). The generic hide loop skips it. Set this whenever the
 *            feature changes how something looks rather than removing it.
 *  risk      'low'   selector is a semantic custom element, unlikely to break
 *            'med'   attribute or structural selector
 *            'high'  class-name dependent, expect churn — covered by the audit skill
 *  since     registry version the feature was added in (for migrations)
 */

const GROUPS = [
  { id: 'home',     label: 'Home & feeds',        blurb: 'The infinite grid that starts every doomscroll.' },
  { id: 'recs',     label: 'Recommendations',     blurb: 'Sidebar, end screens, and in-video nudges.' },
  { id: 'shorts',   label: 'Shorts',              blurb: 'Every entry point, not just the shelf.' },
  { id: 'comments', label: 'Comments & chat',     blurb: 'Hide outright, or collapse behind one click.' },
  { id: 'player',   label: 'Player behaviour',    blurb: 'Autoplay, ambient mode, end cards.' },
  { id: 'social',   label: 'Social pressure',     blurb: 'Counts, badges, and buy-buttons.' },
  { id: 'nav',      label: 'Navigation & chrome', blurb: 'Left rail, notifications, search extras.' },
  { id: 'search',   label: 'Search results',      blurb: 'Keep search a tool, not a feed.' },
  { id: 'visual',   label: 'Visual calm',         blurb: 'Blunt-instrument options that defeat thumbnail bait.' },
];

const REGISTRY = [
  // ───────────────────────── HOME & FEEDS ─────────────────────────
  {
    id: 'home_feed', group: 'home', pages: 'home', kind: 'css', risk: 'low', since: 1,
    label: 'Homepage video grid',
    desc: 'Replaces the recommendation wall with an empty, calm page.',
    sel: ['ytd-browse[page-subtype="home"] ytd-rich-grid-renderer'],
    modes: { study: true, music: true, casual: true },
  },
  {
    id: 'home_chips', group: 'home', pages: 'home', kind: 'css', risk: 'low', since: 1,
    label: 'Topic filter chips',
    desc: 'The "All / Music / Gaming / Live" bar above the grid.',
    sel: ['ytd-browse[page-subtype="home"] #chips-wrapper', 'ytd-feed-filter-chip-bar-renderer'],
    modes: { study: true, music: false, casual: true },
  },
  {
    id: 'home_placeholder', group: 'home', pages: 'home', kind: 'js', risk: 'low', since: 1,
    label: 'Show a calm placeholder',
    desc: 'Puts a search box and your own message where the feed was, instead of blank space.',
    handler: 'homePlaceholder',
    modes: { study: true, music: false, casual: false },
  },
  {
    id: 'subs_feed', group: 'home', pages: 'subs', kind: 'css', risk: 'low', since: 1,
    label: 'Subscriptions feed',
    desc: 'Hides the subscriptions grid too. Most people want this ON for study, OFF otherwise.',
    sel: ['ytd-browse[page-subtype="subscriptions"] ytd-rich-grid-renderer'],
    modes: { study: false, music: false, casual: false },
  },
  {
    id: 'redirect_home_to_subs', group: 'home', pages: 'home', kind: 'js', risk: 'low', since: 1,
    label: 'Redirect home → subscriptions',
    desc: 'Opening youtube.com lands on your subscriptions instead of the algorithm.',
    handler: 'redirectHomeToSubs',
    modes: { study: false, music: false, casual: false },
  },
  {
    id: 'home_ads', group: 'home', pages: 'all', kind: 'css', risk: 'med', since: 1,
    label: 'Promoted / masthead units',
    desc: 'In-feed promoted videos and the top banner slot.',
    sel: ['ytd-rich-section-renderer:has(ytd-statement-banner-renderer)', 'ytd-display-ad-renderer', 'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer'],
    modes: { study: true, music: true, casual: true },
  },

  // ───────────────────────── RECOMMENDATIONS ─────────────────────────
  {
    id: 'watch_sidebar', group: 'recs', pages: 'watch', kind: 'css', risk: 'low', since: 1,
    label: 'Watch-page sidebar',
    desc: 'The "up next" column. The single highest-value toggle in the extension.',
    sel: ['#secondary.ytd-watch-flexy', '#related'],
    modes: { study: true, music: true, casual: true },
  },
  {
    id: 'watch_sidebar_widen', group: 'recs', pages: 'watch', kind: 'css', risk: 'med', since: 1, style: true,
    label: 'Widen player into the gap',
    desc: 'Without this, hiding the sidebar leaves an ugly empty column.',
    sel: [], // implemented as a layout rule, see styles/layout.css
    modes: { study: true, music: true, casual: true },
  },
  {
    id: 'endscreen', group: 'recs', pages: 'watch', kind: 'css', risk: 'med', since: 1,
    label: 'End-of-video wall',
    desc: 'The grid of thumbnails that covers the video the second it ends.',
    sel: ['.ytp-endscreen-content', '.html5-endscreen', '.ytp-ce-video', '.ytp-ce-playlist'],
    modes: { study: true, music: true, casual: true },
  },
  {
    id: 'info_cards', group: 'recs', pages: 'watch', kind: 'css', risk: 'med', since: 1,
    label: 'In-video cards & annotations',
    desc: 'The little "i" teaser that pops out mid-video.',
    sel: ['.ytp-cards-teaser', '.ytp-ce-element', '.iv-branding', '.annotation'],
    modes: { study: true, music: true, casual: true },
  },
  {
    id: 'related_to_search', group: 'recs', pages: 'search', kind: 'css', risk: 'med', since: 1,
    label: '"People also search for"',
    desc: 'The lateral-drift shelves injected into search results.',
    sel: ['ytd-horizontal-card-list-renderer', 'ytd-shelf-renderer:has(#title-text)'],
    modes: { study: true, music: false, casual: true },
  },
  {
    id: 'mixes', group: 'recs', pages: 'all', kind: 'css', risk: 'med', since: 1,
    label: 'Auto-generated mixes',
    desc: 'Endless algorithmic "Mix — YouTube" playlists. Keep OFF in Music mode.',
    sel: ['ytd-radio-renderer', 'ytd-compact-radio-renderer'],
    modes: { study: true, music: false, casual: true },
  },
  {
    id: 'playlists_sitewide', group: 'recs', pages: 'all', kind: 'css', risk: 'low', since: 1,
    label: 'All playlists sitewide',
    desc: 'DF Tube parity option. Aggressive — most people leave this off.',
    sel: ['ytd-playlist-renderer', 'ytd-compact-playlist-renderer', 'ytd-playlist-panel-renderer'],
    modes: { study: false, music: false, casual: false },
  },

  // ───────────────────────── SHORTS ─────────────────────────
  {
    id: 'shorts_redirect', group: 'shorts', pages: 'shorts', kind: 'js', risk: 'low', since: 1,
    label: 'Redirect Shorts → normal player',
    desc: 'youtube.com/shorts/ID becomes youtube.com/watch?v=ID. Kills the swipe feed dead while still letting links you were sent actually open.',
    handler: 'shortsRedirect',
    modes: { study: true, music: true, casual: true },
  },
  {
    id: 'shorts_shelf', group: 'shorts', pages: 'all', kind: 'css', risk: 'low', since: 1,
    label: 'Shorts shelves',
    desc: 'The horizontal Shorts rows wherever they appear.',
    sel: ['ytd-rich-shelf-renderer[is-shorts]', 'ytd-reel-shelf-renderer', 'ytm-shorts-lockup-view-model'],
    modes: { study: true, music: true, casual: true },
  },
  {
    id: 'shorts_nav', group: 'shorts', pages: 'all', kind: 'css', risk: 'med', since: 1,
    label: 'Shorts link in the left rail',
    desc: 'Removes the entry point from the guide and the mini-guide.',
    sel: ['ytd-guide-entry-renderer:has(a[title="Shorts"])', 'ytd-mini-guide-entry-renderer[aria-label="Shorts"]'],
    modes: { study: true, music: true, casual: true },
  },
  {
    id: 'shorts_search', group: 'shorts', pages: 'search', kind: 'css', risk: 'med', since: 1,
    label: 'Shorts in search results',
    desc: 'Search returns videos only.',
    sel: ['ytd-video-renderer:has(a[href^="/shorts/"])', 'ytd-reel-shelf-renderer'],
    modes: { study: true, music: true, casual: true },
  },
  {
    id: 'shorts_channel_tab', group: 'shorts', pages: 'channel', kind: 'css', risk: 'high', since: 1,
    label: 'Shorts tab on channels',
    desc: 'Hides the Shorts tab from channel pages.',
    sel: ['yt-tab-shape[tab-title="Shorts"]', 'tp-yt-paper-tab:has(a[href$="/shorts"])'],
    modes: { study: true, music: false, casual: false },
  },
  {
    id: 'shorts_subs', group: 'shorts', pages: 'subs', kind: 'css', risk: 'med', since: 1,
    label: 'Shorts in subscriptions',
    desc: 'Keeps the subs feed to long-form only.',
    sel: ['ytd-browse[page-subtype="subscriptions"] ytd-rich-shelf-renderer[is-shorts]'],
    modes: { study: true, music: true, casual: true },
  },

  // ───────────────────────── COMMENTS & CHAT ─────────────────────────
  {
    id: 'comments_collapse', group: 'comments', pages: 'watch', kind: 'js', risk: 'low', since: 1,
    label: 'Collapse comments behind a button',
    desc: 'Better than hiding: you keep access, you just stop falling in. Mutually exclusive with the next toggle.',
    handler: 'collapseComments',
    modes: { study: true, music: false, casual: true },
  },
  {
    id: 'comments_hide', group: 'comments', pages: 'watch', kind: 'css', risk: 'low', since: 1,
    label: 'Hide comments completely',
    desc: 'No button, no comments.',
    sel: ['ytd-comments#comments', '#comments'],
    modes: { study: false, music: false, casual: false },
  },
  {
    id: 'comment_avatars', group: 'comments', pages: 'watch', kind: 'css', risk: 'med', since: 1,
    label: 'Commenter profile pictures',
    desc: 'Lowers the visual noise if you keep comments on.',
    sel: ['ytd-comment-view-model #author-thumbnail', '#author-thumbnail.ytd-comment-view-model'],
    modes: { study: false, music: false, casual: false },
  },
  {
    id: 'live_chat', group: 'comments', pages: 'watch', kind: 'css', risk: 'low', since: 1,
    label: 'Live chat panel',
    desc: 'Hides chat on live streams and premieres.',
    sel: ['ytd-live-chat-frame#chat', '#chat-container'],
    modes: { study: true, music: true, casual: false },
  },

  // ───────────────────────── PLAYER BEHAVIOUR ─────────────────────────
  {
    id: 'autoplay_off', group: 'player', pages: 'watch', kind: 'js', risk: 'med', since: 1,
    label: 'Force autoplay off',
    desc: 'Flips the player toggle and re-flips it whenever YouTube turns it back on.',
    handler: 'forceAutoplayOff',
    modes: { study: true, music: false, casual: true },
  },
  {
    id: 'ambient_off', group: 'player', pages: 'watch', kind: 'js', risk: 'med', since: 1,
    label: 'Disable ambient mode',
    desc: 'Stops the coloured glow bleeding out of the player.',
    handler: 'disableAmbient',
    modes: { study: true, music: false, casual: false },
  },
  {
    id: 'pause_on_blur', group: 'player', pages: 'watch', kind: 'js', risk: 'low', since: 1,
    label: 'Pause when you switch tabs',
    desc: 'Nobody else has this. Stops the "video kept playing while I worked" trap.',
    handler: 'pauseOnBlur',
    modes: { study: false, music: false, casual: false },
  },

  // ───────────────────────── SOCIAL PRESSURE ─────────────────────────
  {
    id: 'view_count', group: 'social', pages: 'watch', kind: 'css', risk: 'high', since: 1,
    label: 'View counts',
    desc: 'Judge the video, not its popularity.',
    sel: ['ytd-watch-metadata #info span.view-count', '#info-container .view-count'],
    modes: { study: false, music: false, casual: false },
  },
  {
    id: 'like_counts', group: 'social', pages: 'watch', kind: 'css', risk: 'high', since: 1,
    label: 'Like counts',
    desc: 'Keeps the button, hides the number.',
    sel: ['ytd-watch-metadata like-button-view-model .yt-spec-button-shape-next__button-text-content'],
    modes: { study: false, music: false, casual: false },
  },
  {
    id: 'merch_shelf', group: 'social', pages: 'watch', kind: 'css', risk: 'low', since: 1,
    label: 'Merch, tickets & offers',
    desc: 'Product shelves under the player.',
    sel: ['ytd-merch-shelf-renderer', 'ytd-ticket-shelf-renderer', '#offer-module'],
    modes: { study: true, music: true, casual: true },
  },
  {
    id: 'description', group: 'social', pages: 'watch', kind: 'css', risk: 'low', since: 1,
    label: 'Video description',
    desc: 'Link farms and sponsor blocks.',
    sel: ['ytd-watch-metadata #description-inner', '#description.ytd-watch-metadata'],
    modes: { study: false, music: false, casual: false },
  },
  {
    id: 'subscribe_button', group: 'social', pages: 'watch', kind: 'css', risk: 'med', since: 1,
    label: 'Subscribe / Join buttons',
    desc: 'Removes the conversion prompts.',
    sel: ['ytd-watch-metadata #subscribe-button', 'ytd-watch-metadata #sponsor-button'],
    modes: { study: false, music: false, casual: false },
  },

  // ───────────────────────── NAVIGATION & CHROME ─────────────────────────
  {
    id: 'guide_rail', group: 'nav', pages: 'all', kind: 'css', risk: 'low', since: 1,
    label: 'Left sidebar',
    desc: 'The whole navigation rail, including Explore and Trending.',
    sel: ['ytd-app #guide', 'tp-yt-app-drawer#guide'],
    modes: { study: true, music: false, casual: false },
  },
  {
    id: 'explore_trending', group: 'nav', pages: 'all', kind: 'css', risk: 'med', since: 1,
    label: 'Explore & Trending entries',
    desc: 'Keeps the rail but drops the discovery entries.',
    sel: ['ytd-guide-entry-renderer:has(a[title="Trending"])', 'ytd-guide-entry-renderer:has(a[title="Explore"])'],
    modes: { study: true, music: true, casual: true },
  },
  {
    id: 'notification_bell', group: 'nav', pages: 'all', kind: 'css', risk: 'med', since: 1,
    label: 'Notification bell',
    desc: 'Removes the red-dot pull.',
    sel: ['ytd-notification-topbar-button-renderer'],
    modes: { study: true, music: true, casual: true },
  },
  {
    id: 'search_suggestions', group: 'nav', pages: 'all', kind: 'css', risk: 'high', since: 1,
    label: 'Search autocomplete',
    desc: 'Search for what you came for, not what it suggests.',
    sel: ['.ytSuggestionComponentSuggestionsContainer', 'ytd-searchbox #suggestions'],
    modes: { study: false, music: false, casual: false },
  },
  {
    id: 'voice_search', group: 'nav', pages: 'all', kind: 'css', risk: 'low', since: 1,
    label: 'Voice search button',
    desc: 'Minor, but it is one less thing.',
    sel: ['#voice-search-button'],
    modes: { study: false, music: false, casual: false },
  },

  // ───────────────────────── SEARCH RESULTS ─────────────────────────
  {
    id: 'search_shelves', group: 'search', pages: 'search', kind: 'css', risk: 'med', since: 1,
    label: '"For you" shelves in search',
    desc: 'Injected recommendation rows between real results.',
    sel: ['ytd-shelf-renderer', 'ytd-universal-watch-card-renderer'],
    modes: { study: true, music: false, casual: false },
  },
  {
    id: 'search_ads', group: 'search', pages: 'search', kind: 'css', risk: 'med', since: 1,
    label: 'Promoted search results',
    desc: 'Ad slots at the top of results.',
    sel: ['ytd-search-pyv-renderer', 'ytd-promoted-sparkles-text-search-renderer'],
    modes: { study: true, music: true, casual: true },
  },

  // ───────────────────────── VISUAL CALM ─────────────────────────
  {
    id: 'grayscale_thumbs', group: 'visual', pages: 'all', kind: 'css', risk: 'low', since: 1, style: true,
    label: 'Grayscale thumbnails',
    desc: 'Nobody ships this and it works disturbingly well — clickbait thumbnails lose most of their pull in black and white.',
    sel: ['ytd-thumbnail img', 'yt-image img'],
    modes: { study: true, music: false, casual: false },
  },
  {
    id: 'hide_thumbs', group: 'visual', pages: 'all', kind: 'css', risk: 'low', since: 1,
    label: 'Text-only mode',
    desc: 'Hides every thumbnail. Titles only, everywhere.',
    sel: ['ytd-thumbnail', 'ytd-playlist-thumbnail'],
    modes: { study: false, music: false, casual: false },
  },
  {
    id: 'dim_ui', group: 'visual', pages: 'all', kind: 'css', risk: 'low', since: 1, style: true,
    label: 'Reduce contrast of chrome',
    desc: 'Fades non-content UI so the video is the brightest thing on screen.',
    sel: ['#masthead-container'],
    modes: { study: false, music: false, casual: false },
  },
];

/** Built-in modes. `custom` is written by the user and stored separately. */
const MODES = ['off', 'casual', 'music', 'study', 'custom'];

const MODE_META = {
  off:    { label: 'Off',    blurb: 'Extension does nothing. Normal YouTube.' },
  casual: { label: 'Casual', blurb: 'Kills the worst of it. Recommendations gone, comments collapsed.' },
  music:  { label: 'Music',  blurb: 'Playlists, mixes and related tracks stay. Visual noise goes.' },
  study:  { label: 'Study',  blurb: 'Search-and-watch only. Everything else is gone.' },
  custom: { label: 'Custom', blurb: 'Your own set of toggles.' },
};

/** Returns the settings object for a built-in mode. */
function defaultsFor(mode) {
  const out = {};
  for (const f of REGISTRY) out[f.id] = mode === 'off' ? false : !!(f.modes && f.modes[mode]);
  return out;
}

const byId = Object.fromEntries(REGISTRY.map((f) => [f.id, f]));
const cssFeatures = REGISTRY.filter((f) => f.kind === 'css' || f.kind === 'both');
const jsFeatures = REGISTRY.filter((f) => f.kind === 'js' || f.kind === 'both');

/* ── Export surface ────────────────────────────────────────────────────────
 * Content scripts in MV3 are CLASSIC scripts — they cannot use `import`.
 * So this file is a plain script that publishes one global namespace, and
 * manifest.json lists it FIRST in the content_scripts array. The options
 * page and the service worker load the same file via a <script> tag /
 * importScripts-style module wrapper. This is the whole reason there is no
 * build step. Do not convert this file to ESM without reading DECISIONS.md.
 */
globalThis.QT = Object.assign(globalThis.QT || {}, {
  GROUPS, REGISTRY, MODES, MODE_META, defaultsFor, byId, cssFeatures, jsFeatures,
  REGISTRY_VERSION: 1,
});

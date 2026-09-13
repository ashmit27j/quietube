/**
 * YOUTUBE PACK — the single source of truth for every YouTube selector,
 * page shape and site-specific behaviour in this extension.
 *
 * ── The pack contract ───────────────────────────────────────────────────────
 * A pack is one object with this shape (see docs/ARCHITECTURE.md for the full
 * writeup and the two optional extension hooks below):
 *
 *   {
 *     id:        stable slug, also the site key in storage and in data-qs-site.
 *     label:     display name for the options page / popup.
 *     hosts:     match patterns for manifest.json's content_scripts + host
 *                permissions for this pack.
 *     pages:     { [pageName]: (url: URL) => boolean } — classifies the
 *                current URL into one of this pack's own page names, checked
 *                by core/main.js in declaration order. No name is reserved
 *                except 'all', which every pack gets for free as a feature's
 *                `pages` value meaning "every page type".
 *     groups:    options-page sections. [{ id, label, blurb }]
 *     features:  the registry — see the field reference below. Every
 *                selector this pack uses lives here and nowhere else.
 *     handlers:  { [name]: (ctx) => cleanupFn | void } for kind:'js'/'both'
 *                features. core/main.js merges these with core/behaviours.js
 *                (core wins a name collision; none exists today).
 *     modes:     { [modeName]: { label, blurb } } — the pack's OWN modes.
 *                'off' and 'custom' are core concepts every pack gets for
 *                free and must not be redeclared here.
 *
 *   Three optional extension hooks beyond the required shape:
 *     customBaseMode: which of this pack's own modes 'custom' starts from
 *                     when the user has no per-feature custom set yet.
 *     modeAliases:    { [oldModeName]: newModeName } — lets a pack rename one
 *                     of its own modes without breaking configs saved under
 *                     the old name. core/storage.js remaps transparently.
 *     navEvents:      custom DOM event names this site's own SPA router
 *                     fires on navigation, for an instant reaction. Purely an
 *                     optimisation — core/main.js's href-poll always catches
 *                     up within 800ms regardless.
 *     buildExtraCss(flags, pageScope): raw CSS for `style: true` features
 *                     (a filter, an opacity, a layout change) that the
 *                     generic hide loop in core/engine.js skips — see D12.
 *                     `pageScope` maps this pack's own page names (plus
 *                     'all') to their `html[data-qs-page="…"]` selector, so
 *                     a rule can be page-scoped without hardcoding the
 *                     attribute name itself.
 *
 * ── Feature field reference ─────────────────────────────────────────────────
 *  id        stable key, also the chrome.storage key. Never rename (migrate instead).
 *  group     options-page section. See `groups` above.
 *  label     short UI label.
 *  desc      one line shown under the label.
 *  kind      'css'  → hidden purely with CSS (preferred: survives SPA re-renders)
 *            'js'   → needs a behaviour handler (this file's `handlers`, or core's)
 *            'both' → CSS hides it, JS does something extra (e.g. redirect)
 *  sel       array of selectors, ordered MOST STABLE FIRST.
 *            Tier 1: custom element tag names (ytd-*, yt-*) — YouTube rarely renames these
 *            Tier 2: [attribute] / id selectors — fairly stable
 *            Tier 3: .class names — churn constantly, last resort only
 *            All selectors in the array are applied; extras are harmless if absent.
 *  pages     which of this pack's own page names this applies to, or 'all'.
 *  handler   for kind 'js'/'both', the handler name (this file, or core's).
 *  modes     default value per mode this pack declares in `modes` above.
 *  style     true → this feature is NOT display:none. Its visual treatment is
 *            hand-written in `buildExtraCss` (a filter, an opacity, a layout
 *            change). The generic hide loop skips it. Set this whenever the
 *            feature changes how something looks rather than removing it.
 *  risk      'low'   selector is a semantic custom element, unlikely to break
 *            'med'   attribute or structural selector
 *            'high'  class-name dependent, expect churn — covered by the audit skill
 *  since     registry version the feature was added in (for migrations)
 *  verified  'live'          confirmed against real YouTube by the last audit
 *            'unverified'    audit could not confirm either way (e.g. an empty
 *                            signed-out feed or no ad served in the session —
 *                            see docs/DECISIONS.md D14). Not a known break.
 *            'needs-account' the target structurally only exists when signed
 *                            in (subs feed, notification bell) — the audit
 *                            skips these rather than reporting false failures.
 *
 * NEVER hardcode a YouTube selector anywhere else in the codebase — least of
 * all in core/, which must work for a site that has never heard of YouTube.
 */
(function () {
  const groups = [
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

  const features = [
    // ───────────────────────── HOME & FEEDS ─────────────────────────
    {
      id: 'home_feed', group: 'home', pages: 'home', kind: 'css', risk: 'low', since: 1, verified: 'live',
      label: 'Homepage video grid',
      desc: 'Replaces the recommendation wall with an empty, calm page.',
      sel: ['ytd-browse[page-subtype="home"] ytd-rich-grid-renderer'],
      modes: { light: true, music: true, deep_focus: true },
    },
    {
      id: 'home_chips', group: 'home', pages: 'home', kind: 'css', risk: 'low', since: 1, verified: 'unverified',
      label: 'Topic filter chips',
      desc: 'The "All / Music / Gaming / Live" bar above the grid.',
      sel: ['ytd-browse[page-subtype="home"] #chips-wrapper', 'ytd-feed-filter-chip-bar-renderer'],
      modes: { light: true, music: false, deep_focus: true },
    },
    {
      id: 'home_placeholder', group: 'home', pages: 'home', kind: 'js', risk: 'low', since: 1, verified: 'live',
      label: 'Show a calm placeholder',
      desc: 'Puts a search box and your own message where the feed was, instead of blank space.',
      handler: 'homePlaceholder',
      modes: { light: false, music: false, deep_focus: true },
    },
    {
      id: 'subs_feed', group: 'home', pages: 'subs', kind: 'css', risk: 'low', since: 1, verified: 'needs-account',
      label: 'Subscriptions feed',
      desc: 'Hides the subscriptions grid too. Most people want this ON for Deep Focus, OFF otherwise.',
      sel: ['ytd-browse[page-subtype="subscriptions"] ytd-rich-grid-renderer'],
      modes: { light: false, music: false, deep_focus: false },
    },
    {
      id: 'redirect_home_to_subs', group: 'home', pages: 'home', kind: 'js', risk: 'low', since: 1, verified: 'live',
      label: 'Redirect home → subscriptions',
      desc: 'Opening youtube.com lands on your subscriptions instead of the algorithm.',
      handler: 'redirectHomeToSubs',
      modes: { light: false, music: false, deep_focus: false },
    },
    {
      id: 'home_ads', group: 'home', pages: 'all', kind: 'css', risk: 'med', since: 1, verified: 'unverified',
      label: 'Promoted / masthead units',
      desc: 'In-feed promoted videos and the top banner slot.',
      sel: ['ytd-rich-section-renderer:has(ytd-statement-banner-renderer)', 'ytd-display-ad-renderer', 'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer'],
      modes: { light: true, music: true, deep_focus: true },
    },

    // ───────────────────────── RECOMMENDATIONS ─────────────────────────
    {
      id: 'watch_sidebar', group: 'recs', pages: 'watch', kind: 'css', risk: 'low', since: 1, verified: 'live',
      label: 'Watch-page sidebar',
      desc: 'The "up next" column. The single highest-value toggle in the extension.',
      sel: ['#secondary.ytd-watch-flexy', '#related'],
      modes: { light: true, music: true, deep_focus: true },
    },
    {
      id: 'watch_sidebar_widen', group: 'recs', pages: 'watch', kind: 'css', risk: 'med', since: 1, style: true, verified: 'live',
      label: 'Widen player into the gap',
      desc: 'Without this, hiding the sidebar leaves an ugly empty column.',
      sel: [], // implemented as a layout rule in buildExtraCss below
      modes: { light: true, music: true, deep_focus: true },
    },
    {
      id: 'endscreen', group: 'recs', pages: 'watch', kind: 'css', risk: 'med', since: 1, verified: 'live',
      label: 'End-of-video wall',
      desc: 'The grid of thumbnails that covers the video the second it ends.',
      sel: ['.ytp-endscreen-content', '.html5-endscreen', '.ytp-ce-video', '.ytp-ce-playlist'],
      modes: { light: true, music: true, deep_focus: true },
    },
    {
      id: 'info_cards', group: 'recs', pages: 'watch', kind: 'css', risk: 'med', since: 1, verified: 'live',
      label: 'In-video cards & annotations',
      desc: 'The little "i" teaser that pops out mid-video.',
      sel: ['.ytp-cards-teaser', '.ytp-ce-element', '.iv-branding', '.annotation'],
      modes: { light: true, music: true, deep_focus: true },
    },
    {
      id: 'related_to_search', group: 'recs', pages: 'search', kind: 'css', risk: 'med', since: 1, verified: 'live',
      label: '"People also search for"',
      desc: 'The lateral-drift shelves injected into search results.',
      sel: ['ytd-horizontal-card-list-renderer', 'ytd-shelf-renderer:has(#title-text)'],
      modes: { light: true, music: false, deep_focus: true },
    },
    {
      id: 'mixes', group: 'recs', pages: 'all', kind: 'css', risk: 'med', since: 1, verified: 'unverified',
      label: 'Auto-generated mixes',
      desc: 'Endless algorithmic "Mix — YouTube" playlists. Keep OFF in Music mode.',
      sel: ['ytd-radio-renderer', 'ytd-compact-radio-renderer'],
      modes: { light: true, music: false, deep_focus: true },
    },
    {
      id: 'playlists_sitewide', group: 'recs', pages: 'all', kind: 'css', risk: 'low', since: 1, verified: 'live',
      label: 'All playlists sitewide',
      desc: 'DF Tube parity option. Aggressive — most people leave this off.',
      sel: ['ytd-playlist-renderer', 'ytd-compact-playlist-renderer', 'ytd-playlist-panel-renderer'],
      modes: { light: false, music: false, deep_focus: false },
    },

    // ───────────────────────── SHORTS ─────────────────────────
    {
      id: 'shorts_redirect', group: 'shorts', pages: 'shorts', kind: 'js', risk: 'low', since: 1, verified: 'live',
      label: 'Redirect Shorts → normal player',
      desc: 'youtube.com/shorts/ID becomes youtube.com/watch?v=ID. Kills the swipe feed dead while still letting links you were sent actually open.',
      handler: 'shortsRedirect',
      modes: { light: true, music: true, deep_focus: true },
    },
    {
      id: 'shorts_shelf', group: 'shorts', pages: 'all', kind: 'css', risk: 'low', since: 1, verified: 'unverified',
      label: 'Shorts shelves',
      desc: 'The horizontal Shorts rows wherever they appear.',
      sel: ['ytd-rich-shelf-renderer[is-shorts]', 'ytd-reel-shelf-renderer', 'ytm-shorts-lockup-view-model'],
      modes: { light: true, music: true, deep_focus: true },
    },
    {
      id: 'shorts_nav', group: 'shorts', pages: 'all', kind: 'css', risk: 'med', since: 1, verified: 'live',
      label: 'Shorts link in the left rail',
      desc: 'Removes the entry point from the guide and the mini-guide.',
      sel: ['ytd-guide-entry-renderer:has(a[title="Shorts"])', 'ytd-mini-guide-entry-renderer[aria-label="Shorts"]'],
      modes: { light: true, music: true, deep_focus: true },
    },
    {
      id: 'shorts_search', group: 'shorts', pages: 'search', kind: 'css', risk: 'low', since: 1, verified: 'live',
      label: 'Shorts in search results',
      desc: 'Search returns videos only.',
      // 2026-09: Shorts in search results now render as ytm-shorts-lockup-
      // view-model (a named custom element, tier 1), not as a ytd-video-renderer
      // with a /shorts/ href — verified live.
      sel: ['ytm-shorts-lockup-view-model', 'ytd-reel-shelf-renderer', 'ytd-video-renderer:has(a[href^="/shorts/"])'],
      modes: { light: true, music: true, deep_focus: true },
    },
    {
      id: 'shorts_channel_tab', group: 'shorts', pages: 'channel', kind: 'css', risk: 'high', since: 1, verified: 'live',
      label: 'Shorts tab on channels',
      desc: 'Hides the Shorts tab from channel pages.',
      sel: ['yt-tab-shape[tab-title="Shorts"]', 'tp-yt-paper-tab:has(a[href$="/shorts"])'],
      modes: { light: false, music: false, deep_focus: true },
    },
    {
      id: 'shorts_subs', group: 'shorts', pages: 'subs', kind: 'css', risk: 'med', since: 1, verified: 'needs-account',
      label: 'Shorts in subscriptions',
      desc: 'Keeps the subs feed to long-form only.',
      sel: ['ytd-browse[page-subtype="subscriptions"] ytd-rich-shelf-renderer[is-shorts]'],
      modes: { light: true, music: true, deep_focus: true },
    },

    // ───────────────────────── COMMENTS & CHAT ─────────────────────────
    {
      id: 'comments_collapse', group: 'comments', pages: 'watch', kind: 'js', risk: 'low', since: 1, verified: 'live',
      label: 'Collapse comments behind a button',
      desc: 'Better than hiding: you keep access, you just stop falling in. Mutually exclusive with the next toggle.',
      handler: 'collapseComments',
      modes: { light: true, music: false, deep_focus: true },
    },
    {
      id: 'comments_hide', group: 'comments', pages: 'watch', kind: 'css', risk: 'low', since: 1, verified: 'live',
      label: 'Hide comments completely',
      desc: 'No button, no comments.',
      sel: ['ytd-comments#comments', '#comments'],
      modes: { light: false, music: false, deep_focus: false },
    },
    {
      id: 'comment_avatars', group: 'comments', pages: 'watch', kind: 'css', risk: 'med', since: 1, verified: 'live',
      label: 'Commenter profile pictures',
      desc: 'Lowers the visual noise if you keep comments on.',
      sel: ['ytd-comment-view-model #author-thumbnail', '#author-thumbnail.ytd-comment-view-model'],
      modes: { light: false, music: false, deep_focus: false },
    },
    {
      id: 'live_chat', group: 'comments', pages: 'watch', kind: 'css', risk: 'low', since: 1, verified: 'unverified',
      label: 'Live chat panel',
      desc: 'Hides chat on live streams and premieres.',
      sel: ['ytd-live-chat-frame#chat', '#chat-container'],
      modes: { light: false, music: true, deep_focus: true },
    },

    // ───────────────────────── PLAYER BEHAVIOUR ─────────────────────────
    {
      id: 'autoplay_off', group: 'player', pages: 'watch', kind: 'js', risk: 'med', since: 1, verified: 'live',
      label: 'Force autoplay off',
      desc: 'Flips the player toggle and re-flips it whenever YouTube turns it back on.',
      handler: 'forceAutoplayOff',
      modes: { light: true, music: false, deep_focus: true },
    },
    {
      id: 'ambient_off', group: 'player', pages: 'watch', kind: 'js', risk: 'med', since: 1, verified: 'live',
      label: 'Disable ambient mode',
      desc: 'Stops the coloured glow bleeding out of the player.',
      handler: 'disableAmbient',
      modes: { light: false, music: false, deep_focus: true },
    },
    {
      // Feature entry stays with the pack it hides for on the YouTube options
      // page; the handler implementation lives in core/behaviours.js because
      // it touches only <video>, not any YouTube-specific markup — see D-
      // "core owns behaviour" and docs/ARCHITECTURE.md's pack contract.
      id: 'pause_on_blur', group: 'player', pages: 'watch', kind: 'js', risk: 'low', since: 1, verified: 'live',
      label: 'Pause when you switch tabs',
      desc: 'Nobody else has this. Stops the "video kept playing while I worked" trap.',
      handler: 'pauseOnBlur',
      modes: { light: false, music: false, deep_focus: false },
    },

    // ───────────────────────── SOCIAL PRESSURE ─────────────────────────
    {
      id: 'view_count', group: 'social', pages: 'watch', kind: 'css', risk: 'med', since: 1, verified: 'live',
      label: 'View counts',
      desc: 'Judge the video, not its popularity.',
      // 2026-09: YouTube split the metadata line into dedicated #view-count /
      // #date-text nodes (a11y "rolling number" redesign); the old .view-count
      // class no longer exists. #view-count is an id inside a named custom
      // element, so this is now tier 2, not tier 3 — verified live.
      sel: ['ytd-watch-info-text #view-count', 'ytd-watch-metadata #info span.view-count', '#info-container .view-count'],
      modes: { light: false, music: false, deep_focus: false },
    },
    {
      id: 'like_counts', group: 'social', pages: 'watch', kind: 'css', risk: 'high', since: 1, verified: 'live',
      label: 'Like counts',
      desc: 'Keeps the button, hides the number.',
      // 2026-09: class renamed from the dashed yt-spec-button-shape-next__*
      // convention to camelCase ytSpecButtonShapeNext* — verified live.
      sel: ['ytd-watch-metadata like-button-view-model .ytSpecButtonShapeNextButtonTextContent', 'ytd-watch-metadata like-button-view-model .yt-spec-button-shape-next__button-text-content'],
      modes: { light: false, music: false, deep_focus: false },
    },
    {
      id: 'merch_shelf', group: 'social', pages: 'watch', kind: 'css', risk: 'low', since: 1, verified: 'unverified',
      label: 'Merch, tickets & offers',
      desc: 'Product shelves under the player.',
      sel: ['ytd-merch-shelf-renderer', 'ytd-ticket-shelf-renderer', '#offer-module'],
      modes: { light: true, music: true, deep_focus: true },
    },
    {
      id: 'description', group: 'social', pages: 'watch', kind: 'css', risk: 'low', since: 1, verified: 'live',
      label: 'Video description',
      desc: 'Link farms and sponsor blocks.',
      sel: ['ytd-watch-metadata #description-inner', '#description.ytd-watch-metadata'],
      modes: { light: false, music: false, deep_focus: false },
    },
    {
      id: 'subscribe_button', group: 'social', pages: 'watch', kind: 'css', risk: 'med', since: 1, verified: 'live',
      label: 'Subscribe / Join buttons',
      desc: 'Removes the conversion prompts.',
      sel: ['ytd-watch-metadata #subscribe-button', 'ytd-watch-metadata #sponsor-button'],
      modes: { light: false, music: false, deep_focus: false },
    },

    // ───────────────────────── NAVIGATION & CHROME ─────────────────────────
    {
      id: 'guide_rail', group: 'nav', pages: 'all', kind: 'css', risk: 'low', since: 1, verified: 'live',
      label: 'Left sidebar',
      desc: 'The whole navigation rail, including Explore and Trending.',
      sel: ['ytd-app #guide', 'tp-yt-app-drawer#guide'],
      modes: { light: false, music: false, deep_focus: true },
    },
    {
      id: 'explore_trending', group: 'nav', pages: 'all', kind: 'js', risk: 'med', since: 1, verified: 'unverified',
      label: 'Explore & Trending entries',
      desc: 'Keeps the rail but drops the discovery entries.',
      // 2026-09 (D14): YouTube dropped "Trending" from the guide outright and
      // turned "Explore" into a heading with no id, class or attribute — only
      // its text distinguishes it, so this can no longer be a CSS selector.
      handler: 'exploreTrending',
      modes: { light: true, music: true, deep_focus: true },
    },
    {
      id: 'notification_bell', group: 'nav', pages: 'all', kind: 'css', risk: 'med', since: 1, verified: 'needs-account',
      label: 'Notification bell',
      desc: 'Removes the red-dot pull.',
      sel: ['ytd-notification-topbar-button-renderer'],
      modes: { light: true, music: true, deep_focus: true },
    },
    {
      id: 'search_suggestions', group: 'nav', pages: 'all', kind: 'css', risk: 'high', since: 1, verified: 'live',
      label: 'Search autocomplete',
      desc: 'Search for what you came for, not what it suggests.',
      // 2026-09: the container class is now ytSearchboxComponent* (was
      // ytSuggestionComponent*); ytd-searchbox no longer exists at all —
      // verified live by typing into the search box.
      sel: ['.ytSearchboxComponentSuggestionsContainer', '.ytSuggestionComponentSuggestionsContainer', 'ytd-searchbox #suggestions'],
      modes: { light: false, music: false, deep_focus: false },
    },
    {
      id: 'voice_search', group: 'nav', pages: 'all', kind: 'css', risk: 'low', since: 1, verified: 'live',
      label: 'Voice search button',
      desc: 'Minor, but it is one less thing.',
      sel: ['#voice-search-button'],
      modes: { light: false, music: false, deep_focus: false },
    },

    // ───────────────────────── SEARCH RESULTS ─────────────────────────
    {
      id: 'search_shelves', group: 'search', pages: 'search', kind: 'css', risk: 'med', since: 1, verified: 'live',
      label: '"For you" shelves in search',
      desc: 'Injected recommendation rows between real results.',
      sel: ['ytd-shelf-renderer', 'ytd-universal-watch-card-renderer'],
      modes: { light: false, music: false, deep_focus: true },
    },
    {
      id: 'search_ads', group: 'search', pages: 'search', kind: 'css', risk: 'med', since: 1, verified: 'unverified',
      label: 'Promoted search results',
      desc: 'Ad slots at the top of results.',
      sel: ['ytd-search-pyv-renderer', 'ytd-promoted-sparkles-text-search-renderer'],
      modes: { light: true, music: true, deep_focus: true },
    },

    // ───────────────────────── VISUAL CALM ─────────────────────────
    {
      id: 'grayscale_thumbs', group: 'visual', pages: 'all', kind: 'css', risk: 'low', since: 1, style: true, verified: 'unverified',
      label: 'Grayscale thumbnails',
      desc: 'Nobody ships this and it works disturbingly well — clickbait thumbnails lose most of their pull in black and white.',
      // 2026-09: channel video grids now render thumbnails as
      // yt-thumbnail-view-model (the same view-model migration already seen in
      // like_counts/search_suggestions/shorts_search), not ytd-thumbnail. Search
      // results still use the old element, so both are "real" depending on
      // rollout — added alongside rather than replacing (D14's A/B-rollout rule).
      sel: ['ytd-thumbnail img', 'yt-thumbnail-view-model img', 'yt-image img'],
      modes: { light: false, music: false, deep_focus: true },
    },
    {
      id: 'hide_thumbs', group: 'visual', pages: 'all', kind: 'css', risk: 'low', since: 1, verified: 'live',
      label: 'Text-only mode',
      desc: 'Hides every thumbnail. Titles only, everywhere.',
      // 2026-09: see grayscale_thumbs — same view-model migration on channel grids.
      sel: ['ytd-thumbnail', 'yt-thumbnail-view-model', 'ytd-playlist-thumbnail'],
      modes: { light: false, music: false, deep_focus: false },
    },
    {
      id: 'dim_ui', group: 'visual', pages: 'all', kind: 'css', risk: 'low', since: 1, style: true, verified: 'live',
      label: 'Reduce contrast of chrome',
      desc: 'Fades non-content UI so the video is the brightest thing on screen.',
      sel: ['#masthead-container'],
      modes: { light: false, music: false, deep_focus: false },
    },
  ];

  const H = {};

  // ── redirects ────────────────────────────────────────────────────────────

  /**
   * /shorts/ID → /watch?v=ID, before the Shorts player boots.
   *
   * Uses replace() so the Shorts URL never enters history — otherwise Back
   * from the watch page returns to the Shorts URL and redirects forward again,
   * trapping the user. The sessionStorage guard catches the pathological case
   * where YouTube restores the /shorts/ URL client-side after we leave.
   */
  H.shortsRedirect = () => {
    const m = location.pathname.match(/^\/shorts\/([\w-]{6,})/);
    if (!m) return;
    const id = m[1];

    const guardKey = 'qs:redirected';
    try {
      if (sessionStorage.getItem(guardKey) === id) return; // already bounced this one
      sessionStorage.setItem(guardKey, id);
    } catch { /* private mode — proceed without the guard */ }

    const url = new URL(`${location.origin}/watch`);
    url.searchParams.set('v', id);
    const t = new URL(location.href).searchParams.get('t');
    if (t) url.searchParams.set('t', t);
    location.replace(url.toString());
  };

  H.redirectHomeToSubs = () => {
    if (location.pathname === '/' || location.pathname === '') {
      location.replace(`${location.origin}/feed/subscriptions`);
    }
  };

  // ── navigation ───────────────────────────────────────────────────────────

  /**
   * Hide the guide's "Explore" section (D14). YouTube dropped "Trending" from
   * the guide outright and turned "Explore" into a heading with no id, class
   * or attribute — text is the only thing that distinguishes it, so this
   * cannot be a CSS selector (rule 2 exception: CSS provably cannot do this).
   *
   * The guide drawer hydrates late and is collapsed by default on the watch
   * page, hence waitFor rather than assuming the section is already there.
   */
  H.exploreTrending = () => {
    const { waitFor, all } = globalThis.QS.dom;
    const MATCH = /^(explore|trending)$/i;

    const hideMatches = () => {
      for (const leaf of document.querySelectorAll('ytd-guide-section-renderer *')) {
        if (leaf.children.length) continue; // only leaf nodes can be "just text"
        const text = (leaf.textContent || '').trim();
        if (!MATCH.test(text)) continue;
        const section = leaf.closest('ytd-guide-section-renderer');
        if (!section || section.dataset.qsHidden === '1') continue;
        section.dataset.qsHidden = '1';
        section.style.display = 'none';
      }
    };

    const cancel = waitFor('ytd-guide-section-renderer', hideMatches);
    const undo = () => {
      for (const section of document.querySelectorAll('ytd-guide-section-renderer[data-qs-hidden="1"]')) {
        delete section.dataset.qsHidden;
        section.style.display = '';
      }
    };
    return all(cancel, undo);
  };

  // ── player ───────────────────────────────────────────────────────────────

  /**
   * Force the player's autoplay toggle off and keep it off.
   * YouTube re-enables it on navigation and sometimes after an ad break, so a
   * one-shot click is not enough. 2s is frequent enough that the user never
   * sees autoplay fire, and cheap enough to be invisible in a profile.
   */
  H.forceAutoplayOff = () =>
    globalThis.QS.dom.every(2000, () => {
      const btn = document.querySelector('.ytp-autonav-toggle-button');
      if (btn && btn.getAttribute('aria-checked') === 'true') btn.click();
    });

  H.disableAmbient = () =>
    globalThis.QS.dom.every(3000, () => {
      for (const el of document.querySelectorAll('#cinematics, .ytp-cinematics-container')) {
        el.style.display = 'none';
      }
    });

  // ── injected UI ──────────────────────────────────────────────────────────

  // Collapse comments behind a button instead of hiding them outright — see
  // core/dom.js's collapseWithReveal for why this lives in core (D15).
  H.collapseComments = () =>
    globalThis.QS.dom.collapseWithReveal('ytd-comments#comments', {
      buttonClass: 'qs-reveal-btn',
      buttonText: 'Show comments',
    });

  /**
   * Replace the home feed with a prompt rather than blank space.
   * An empty page reads as broken; a question reads as intentional, and
   * reframes the visit from browsing to searching.
   */
  H.homePlaceholder = () => {
    const { waitFor, all } = globalThis.QS.dom;
    let undo = () => {};
    const cancel = waitFor('ytd-browse[page-subtype="home"]', (host) => {
      if (document.getElementById('qs-placeholder')) return;

      const box = document.createElement('div');
      box.id = 'qs-placeholder';

      const text = document.createElement('p');
      text.className = 'qs-ph-text';
      text.textContent = 'What did you come here to watch?';

      box.append(text);
      host.prepend(box);
      undo = () => box.remove();
    });
    return all(cancel, () => undo());
  };

  // ── pack assembly ────────────────────────────────────────────────────────

  const pages = {
    home:    (url) => url.pathname === '/' || url.pathname === '',
    watch:   (url) => url.pathname.startsWith('/watch'),
    shorts:  (url) => url.pathname.startsWith('/shorts'),
    search:  (url) => url.pathname.startsWith('/results'),
    subs:    (url) => url.pathname.startsWith('/feed/subscriptions'),
    channel: (url) => url.pathname.startsWith('/@') || url.pathname.startsWith('/channel/') || url.pathname.startsWith('/c/'),
  };

  const modes = {
    // 'light' and 'deep_focus' are the sitewide generic mode names (see
    // packs/reddit.js and docs/DECISIONS.md D15/D17) — renamed from this
    // pack's original 'casual'/'study'. 'music' has no generic equivalent
    // and stays a YouTube-only extra; a pack declares whichever modes it
    // supports, it isn't forced to invent a fourth to match this one.
    light:      { label: 'Light', blurb: 'Kills the worst of it. Recommendations gone, comments collapsed.' },
    music:      { label: 'Music', blurb: 'Playlists, mixes and related tracks stay. Visual noise goes.' },
    deep_focus: { label: 'Deep Focus', blurb: 'Search-and-watch only. Everything else is gone.' },
  };

  /**
   * Hand-written CSS for `style: true` features — a filter, an opacity, a
   * layout change, never display:none (see D12). Everything else is the
   * generic hide loop in core/engine.js.
   */
  function buildExtraCss(flags, pageScope) {
    const out = [];
    if (flags.grayscale_thumbs && !flags.hide_thumbs) {
      out.push(
        `/* grayscale_thumbs */\nytd-thumbnail img, yt-thumbnail-view-model img, yt-image img, .yt-core-image { filter: grayscale(1) !important; transition: filter .18s; }\nytd-thumbnail:hover img, yt-thumbnail-view-model:hover img { filter: grayscale(0) !important; }`
      );
    }
    if (flags.dim_ui) {
      out.push(`/* dim_ui */\n#masthead-container, ytd-guide-renderer { opacity: .45 !important; transition: opacity .2s; }\n#masthead-container:hover, ytd-guide-renderer:hover { opacity: 1 !important; }`);
    }
    if (flags.watch_sidebar && flags.watch_sidebar_widen) {
      // Reclaim the column the sidebar left behind.
      out.push(
        `/* watch_sidebar_widen */\n${pageScope.watch} ytd-watch-flexy[flexy] #primary.ytd-watch-flexy { max-width: none !important; }\n${pageScope.watch} ytd-watch-flexy #columns { max-width: 1600px !important; margin: 0 auto !important; }`
      );
    }
    return out.join('\n\n');
  }

  const pack = {
    id: 'youtube',
    label: 'YouTube',
    hosts: ['*://*.youtube.com/*'],
    pages,
    groups,
    features,
    handlers: H,
    modes,
    customBaseMode: 'light',
    // Old stored mode names, remapped transparently by core/storage.js so a
    // config saved before the light/deep_focus rename still resolves.
    modeAliases: { casual: 'light', study: 'deep_focus' },
    navEvents: ['yt-navigate-finish'], // YouTube's own SPA router signal
    buildExtraCss,
  };

  // `pack` is "the active one" (what a content script's core/ files read);
  // `packs` accumulates every pack loaded into this context, for pages like
  // the popup/options that load more than one — see docs/ARCHITECTURE.md.
  globalThis.QS = Object.assign(globalThis.QS || {}, {
    pack,
    packs: { ...(globalThis.QS && globalThis.QS.packs), [pack.id]: pack },
  });
})();

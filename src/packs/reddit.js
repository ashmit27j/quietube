/**
 * REDDIT PACK — the second pack, and the one that proves (or disproves) the
 * core/pack split from the YouTube pack. See packs/youtube.js for the full
 * pack-contract and feature-field writeup; this file follows it exactly.
 *
 * ── Verification status (read before trusting any selector here) ──────────
 * Every selector in this file is `verified: 'unverified'`, and it stays that
 * way honestly rather than optimistically: this session's network is blocked
 * by Reddit's own bot detection at the HTTP layer (www.reddit.com,
 * old.reddit.com and the .json API all returned a "blocked by network
 * security" page to Playwright, not a selector-shaped problem — see
 * docs/DECISIONS.md D15). The selectors below are written from documented
 * knowledge of Reddit's current web-component ("shreddit-*") frontend, not
 * from a live page inspected this session. Before shipping this pack, verify
 * every entry with the `site-selector-audit` skill's three-tier method from a
 * network that can actually reach reddit.com, the same way `verified: 'live'`
 * was earned for every YouTube entry.
 */
(function () {
  const groups = [
    { id: 'feed',     label: 'Feed',      blurb: 'Promoted posts and inline discovery cards.' },
    { id: 'sidebar',  label: 'Sidebar',   blurb: 'The right-hand rail: trending, communities, everything.' },
    { id: 'social',   label: 'Social pressure', blurb: 'Awards, coins, and other spend-prompts.' },
    { id: 'comments', label: 'Comments', blurb: 'Hide outright, or collapse behind one click.' },
  ];

  const features = [
    // ───────────────────────── FEED ─────────────────────────
    {
      id: 'promoted_posts', group: 'feed', pages: 'all', kind: 'css', risk: 'med', since: 1, verified: 'unverified',
      label: 'Promoted posts',
      desc: 'Sponsored posts injected into feeds.',
      sel: ['shreddit-post[promoted]', 'shreddit-ad-post', '[promotedlabel]'],
      modes: { light: true, deep_focus: true },
    },
    {
      id: 'recommended_communities', group: 'feed', pages: 'all', kind: 'css', risk: 'med', since: 1, verified: 'unverified',
      label: 'Recommended community cards',
      desc: 'Inline "communities for you" cards injected between posts.',
      sel: ['shreddit-subreddit-recommendation-carousel', 'community-highlight-carousel', 'shreddit-feed-discovery-unit'],
      modes: { light: true, deep_focus: true },
    },

    // ───────────────────────── SIDEBAR ─────────────────────────
    {
      id: 'trending_sidebar', group: 'sidebar', pages: 'home', kind: 'css', risk: 'med', since: 1, verified: 'unverified',
      label: 'Trending Today & Popular Communities',
      desc: 'The discovery modules in the right rail.',
      sel: ['shreddit-sidebar-widget[widget-name*="trending"]', 'shreddit-sidebar-widget[widget-name*="popular-communities"]'],
      modes: { light: true, deep_focus: true },
    },
    {
      id: 'right_sidebar', group: 'sidebar', pages: 'all', kind: 'css', risk: 'low', since: 1, verified: 'unverified',
      label: 'Right sidebar (all of it)',
      desc: 'Removes the whole right-hand rail, not just the discovery widgets.',
      sel: ['#right-sidebar-container', 'shreddit-sidebar'],
      modes: { light: false, deep_focus: true },
    },

    // ───────────────────────── SOCIAL PRESSURE ─────────────────────────
    {
      id: 'award_prompts', group: 'social', pages: 'all', kind: 'css', risk: 'med', since: 1, verified: 'unverified',
      label: 'Award & coin prompts',
      desc: 'Gild/award buttons and coin-purchase upsells.',
      sel: ['shreddit-award-button', 'shreddit-gild-modal', 'shreddit-premium-banner'],
      modes: { light: true, deep_focus: true },
    },

    // ───────────────────────── COMMENTS ─────────────────────────
    {
      id: 'comment_collapse', group: 'comments', pages: 'comments', kind: 'js', risk: 'low', since: 1, verified: 'unverified',
      label: 'Collapse comments behind a button',
      desc: 'Same escape hatch as YouTube: keep access, just stop falling in.',
      handler: 'collapseComments',
      modes: { light: false, deep_focus: true },
    },
  ];

  const H = {};

  // core/dom.js's collapseWithReveal was extracted from this exact
  // choreography — see packs/youtube.js's own collapseComments and D15.
  H.collapseComments = () =>
    globalThis.QS.dom.collapseWithReveal('shreddit-comment-tree', {
      buttonClass: 'qs-reveal-btn',
      buttonText: 'Show comments',
    });

  const pages = {
    home:      (url) => url.pathname === '/' || url.pathname === '',
    search:    (url) => url.pathname.startsWith('/search'),
    comments:  (url) => /^\/r\/[^/]+\/comments\//.test(url.pathname),
    subreddit: (url) => /^\/r\/[^/]+\/?$/.test(url.pathname),
  };

  const modes = {
    // Generic mode names rather than a Reddit-flavoured pair (step 6 makes
    // these the sitewide default anyway) — see docs/DECISIONS.md D15.
    light:      { label: 'Light', blurb: 'Removes ads and the noisiest prompts; the rest of Reddit stays normal.' },
    deep_focus: { label: 'Deep Focus', blurb: 'Feed noise and the sidebar are gone — search and read only.' },
  };

  const pack = {
    id: 'reddit',
    label: 'Reddit',
    hosts: ['*://*.reddit.com/*'],
    pages,
    groups,
    features,
    handlers: H,
    modes,
    customBaseMode: 'light',
    // No navEvents: this pack's SPA-navigation event name (if any) is one of
    // the things that couldn't be confirmed without live access (D15) — the
    // generic href-poll in core/main.js is fully sufficient, just slightly
    // less instant, so this is a real (not merely theoretical) exercise of
    // that fallback path.
  };

  // See packs/youtube.js's export for why both `pack` and `packs` are set.
  globalThis.QS = Object.assign(globalThis.QS || {}, {
    pack,
    packs: { ...(globalThis.QS && globalThis.QS.packs), [pack.id]: pack },
  });
})();

/**
 * LINKEDIN PACK — the third pack. See packs/youtube.js for the full
 * pack-contract and feature-field writeup; this file follows it exactly.
 *
 * ── Verification status (read before trusting any selector here) ──────────
 * Every selector in this file is `verified: 'needs-account'`, and for a
 * stronger reason than Reddit's network block (D15): LinkedIn's feed,
 * sidebar and notifications simply do not exist for a signed-out session —
 * `/` and `/feed/` both redirect straight to a sign-in wall (confirmed live,
 * this session — LinkedIn itself was reachable, unlike reddit.com). There is
 * no authenticated LinkedIn account available to verify against here, so
 * every selector below is written from documented knowledge of LinkedIn's
 * class-name-heavy (no custom elements, unlike YouTube/Reddit) DOM rather
 * than a live page. Treat every `sel` entry as a starting point, not a
 * confirmed one — verify with the `site-selector-audit` skill from a real,
 * signed-in session before promoting anything to `verified: 'live'`.
 */
(function () {
  const groups = [
    { id: 'feed',   label: 'Feed',    blurb: 'Promoted posts and feed-injected discovery cards.' },
    { id: 'sidebar', label: 'Sidebar', blurb: 'The right-hand rail: news, people you may know, upsells.' },
    { id: 'social', label: 'Social pressure', blurb: 'Notification badges and Premium prompts.' },
    { id: 'comments', label: 'Comments', blurb: 'Hide outright, or collapse behind one click.' },
  ];

  const features = [
    // ───────────────────────── FEED ─────────────────────────
    {
      id: 'promoted_posts', group: 'feed', pages: 'feed', kind: 'css', risk: 'high', since: 1, verified: 'needs-account',
      label: 'Promoted posts',
      desc: 'Sponsored posts injected into the feed.',
      sel: ['[data-ad-banner]', '.feed-shared-update-v2--minimal-padding:has(.update-components-actor__supplementary-actor-info)'],
      modes: { light: true, deep_focus: true },
    },
    {
      id: 'suggested_content', group: 'feed', pages: 'feed', kind: 'css', risk: 'high', since: 1, verified: 'needs-account',
      label: 'Suggested / "Because you follow" cards',
      desc: 'Feed-injected discovery cards unrelated to your own network.',
      sel: ['.feed-shared-suggested-actors', '.feed-shared-news-module'],
      modes: { light: true, deep_focus: true },
    },

    // ───────────────────────── SIDEBAR ─────────────────────────
    {
      id: 'pymk_sidebar', group: 'sidebar', pages: 'feed', kind: 'css', risk: 'high', since: 1, verified: 'needs-account',
      label: '"People You May Know"',
      desc: 'The connection-growth module in the right rail and its own page.',
      sel: ['.mn-pymk-list', '[data-view-name="pymk-vertical-list"]'],
      modes: { light: true, deep_focus: true },
    },
    {
      id: 'news_sidebar', group: 'sidebar', pages: 'feed', kind: 'css', risk: 'high', since: 1, verified: 'needs-account',
      label: 'LinkedIn News',
      desc: 'The trending-topics module in the right rail.',
      sel: ['.news-module'],
      modes: { light: true, deep_focus: true },
    },
    {
      id: 'right_sidebar', group: 'sidebar', pages: 'all', kind: 'css', risk: 'high', since: 1, verified: 'needs-account',
      label: 'Right sidebar (all of it)',
      desc: 'Removes the whole right-hand rail, not just the discovery widgets.',
      sel: ['.scaffold-layout__aside'],
      modes: { light: false, deep_focus: true },
    },
    {
      id: 'premium_upsells', group: 'sidebar', pages: 'all', kind: 'css', risk: 'high', since: 1, verified: 'needs-account',
      label: 'Premium upsell banners',
      desc: '"Try Premium" prompts in the sidebar and feed.',
      sel: ['.premium-upsell-link', '[data-test-id="premium-upsell"]'],
      modes: { light: true, deep_focus: true },
    },

    // ───────────────────────── SOCIAL PRESSURE ─────────────────────────
    {
      id: 'notification_badge', group: 'social', pages: 'all', kind: 'css', risk: 'high', since: 1, verified: 'needs-account',
      label: 'Notification badge',
      desc: 'Removes the red unread-count pull on the bell icon.',
      sel: ['.notification-badge'],
      modes: { light: true, deep_focus: true },
    },

    // ───────────────────────── COMMENTS ─────────────────────────
    {
      id: 'comment_collapse', group: 'comments', pages: 'feed', kind: 'js', risk: 'high', since: 1, verified: 'needs-account',
      label: 'Collapse comments behind a button',
      desc: 'Same escape hatch as YouTube and Reddit: keep access, just stop falling in.',
      handler: 'collapseComments',
      modes: { light: false, deep_focus: true },
    },
  ];

  const H = {};

  // core/dom.js's collapseWithReveal was extracted from this exact
  // choreography — see packs/youtube.js's own collapseComments and D15.
  H.collapseComments = () =>
    globalThis.QS.dom.collapseWithReveal('.comments-comments-list', {
      buttonClass: 'qs-reveal-btn',
      buttonText: 'Show comments',
    });

  const pages = {
    feed:          (url) => url.pathname === '/' || url.pathname.startsWith('/feed'),
    profile:       (url) => url.pathname.startsWith('/in/'),
    jobs:          (url) => url.pathname.startsWith('/jobs'),
    notifications: (url) => url.pathname.startsWith('/notifications'),
    search:        (url) => url.pathname.startsWith('/search'),
  };

  const modes = {
    // Generic mode names, same convention as Reddit's — see D15/D17.
    light:      { label: 'Light', blurb: 'Removes ads and the noisiest prompts; the rest of LinkedIn stays normal.' },
    deep_focus: { label: 'Deep Focus', blurb: 'Feed noise and the sidebar are gone — search and read only.' },
  };

  const pack = {
    id: 'linkedin',
    label: 'LinkedIn',
    hosts: ['*://*.linkedin.com/*'],
    pages,
    groups,
    features,
    handlers: H,
    modes,
    customBaseMode: 'light',
    // No navEvents: same reasoning as Reddit's pack — this site's own
    // SPA-navigation event name is one more thing that needs a live,
    // signed-in session to confirm. The generic href-poll in core/main.js
    // covers it, just slightly less instantly.
  };

  // See packs/youtube.js's export for why both `pack` and `packs` are set.
  globalThis.QS = Object.assign(globalThis.QS || {}, {
    pack,
    packs: { ...(globalThis.QS && globalThis.QS.packs), [pack.id]: pack },
  });
})();

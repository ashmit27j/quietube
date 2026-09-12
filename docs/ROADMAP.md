# Roadmap

## v0.1 — scaffold (this repo)
Registry, CSS engine, storage/mode resolution, popup, options page, service
worker, docs. Behaviour handlers are written but unverified against live
YouTube.

## v0.2 — verified
- [x] Run `/audit-selectors` against live YouTube; fix every stale selector
      that turned out to be genuinely stale (`view_count`, `like_counts`,
      `shorts_search` — see CHANGELOG). `explore_trending` needs a `kind:'js'`
      rewrite (no CSS-only selector survives; see CHANGELOG "Known issue").
      `home_chips` / `home_ads` / `mixes` / `search_ads` / `notification_bell`
      could not be verified either way in a signed-out, history-less browser
      and need a manual pass from a real account.
- [ ] Playwright suite green on home / watch / search / subs / channel / shorts
      — blocked on the same feed-personalization and sign-in gaps above; the
      offline suite (60 tests) is green, `npm run test:live` is not and won't
      fully clear until those items are resolved from a real account.
- [ ] Record a cold load with network throttling; confirm no feed flash.
- [x] Icons (16/32/48/128) — present in `src/icons/`.
- [ ] Fix the sidebar-widen layout rule at 1280px and 1920px.

## v1.0 — store submission
- [ ] Store listing copy + 5 screenshots + 1280×800 promo tile (`store/`).
- [ ] Privacy practices form: single purpose, `storage` justification, "no data
      collected" declaration.
- [ ] Public GitHub repo with the MIT licence, linked from the listing. Being
      auditable is a big part of the trust pitch.
- [ ] Landing page (optional but helps conversion from the store listing).

## v1.1 — the things people will ask for within a week
- **Per-channel rules.** Allow recommendations on channels you trust, lock
  everything down elsewhere. Design: `rules: [{ match: 'channelId|urlRegex',
  mode }]` resolved in `storage.resolve()` before overrides. Needs the channel
  id, which is readable from the watch page DOM — no extra permission.
- **Stats.** Local-only counters: distractions hidden, sessions, time on site.
  Adds a second storage model and a privacy paragraph; worth it for the store
  listing screenshots. Must stay `storage.local` and never sync.
- **Intent prompt.** Before the home page loads, ask "what are you here for?"
  and show the answer as the placeholder. Cheap; high perceived value.
- **Firefox port.** The code is already MV3-compatible-ish; the main work is
  `browser.*` vs `chrome.*` and a separate AMO listing.

## Deliberately not doing
- Ad blocking of any kind.
- Anything requiring a server, account, or payment.
- Video downloading.

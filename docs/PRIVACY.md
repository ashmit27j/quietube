# Privacy policy

**Quiet collects nothing. There is no server. There is no network request.**

## What is stored

Your settings — which mode you have selected, which individual toggles you have
overridden, your schedule rules, and your placeholder text. That is the entire
list.

They are stored using Chrome's `storage.sync` API, which means Chrome syncs
them between your own signed-in Chrome profiles. That sync is between you and
Google, using a mechanism built into Chrome; the data never reaches the
developer of this extension, who has no server to receive it.

A copy of the resolved on/off flags is also cached in `localStorage` on
youtube.com. This is a performance cache that lets the extension hide things
before the page paints. It contains no personal data and is overwritten from
your settings on every page load.

## What is not collected

- No browsing history. The extension cannot see any site other than
  youtube.com, and it does not record what you watch there.
- No analytics, telemetry, crash reporting, or usage statistics.
- No account, email, or identifier of any kind.
- No advertising, and no data sold or shared with anyone, because none is
  collected.

## Permissions and why

| Permission | Why |
|---|---|
| `storage` | To save your toggle settings. |
| `*://*.youtube.com/*` | To run the content script that applies your settings. Only youtube.com. |

The extension does not request `tabs`, `notifications`, `scripting`,
`webRequest`, or access to any other site.

## Verifying this yourself

The source is public and unminified. There is no build step, so what is on the
Chrome Web Store is what is in the repository. To check the no-network claim:

```bash
grep -rnE "fetch\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket" src/
```

That command returns nothing.

## Changes

If this ever changes, it changes in a released version with a changelog entry
saying so, and the store listing's data disclosures are updated in the same
release.

_Last updated: with v0.1.0._

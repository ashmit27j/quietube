# Privacy policy

**QuietSurf collects nothing. There is no server. There is no network request.**

## What is stored

Your settings — the master on/off switch, which mode you have selected per
site, which individual toggles you have overridden per site, your schedule
rules, and which sites you have granted access to. That is the entire list.

They are stored using Chrome's `storage.sync` API, which means Chrome syncs
them between your own signed-in Chrome profiles. That sync is between you and
Google, using a mechanism built into Chrome; the data never reaches the
developer of this extension, who has no server to receive it.

A copy of the resolved on/off flags for each site you've enabled is also
cached in that site's own `localStorage`. This is a performance cache that
lets the extension hide things before the page paints. It contains no
personal data and is overwritten from your settings on every page load.

## What is not collected

- No browsing history. The extension cannot see any site until you
  explicitly enable it (see Permissions below), and it does not record what
  you view on the sites you do enable.
- No analytics, telemetry, crash reporting, or usage statistics.
- No account, email, or identifier of any kind.
- No advertising, and no data sold or shared with anyone, because none is
  collected.

## Permissions and why

QuietSurf installs with **no site access at all**. Each site it supports
(YouTube, Reddit, and any added later) is an *optional* permission you grant
one at a time, the first time you turn it on — in the popup or options page,
picking any mode other than Off for that site asks Chrome's own permission
prompt for that site only. You can revoke access for any site at any time
from `chrome://extensions` without uninstalling the extension.

| Permission | Why |
|---|---|
| `storage` | To save your toggle settings. |
| `scripting` | To start applying your settings on a site immediately after you grant it, without waiting for a browser restart. Only used for sites you have enabled. |
| `*://*.youtube.com/*` (optional) | To run the YouTube pack. Requested only when you enable YouTube. |
| `*://*.reddit.com/*` (optional) | To run the Reddit pack. Requested only when you enable Reddit. |

The extension does not request `tabs`, `notifications`, `webRequest`, or
access to any site beyond the packs above — and, unlike the single-site
version, it does not even hold those by default.

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

_Last updated: with the optional-permissions model (D16)._

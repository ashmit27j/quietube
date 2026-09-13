# Testing

## Manual checklist (do this before every release)

Load unpacked from `src/`, open the popup on a youtube.com tab and pick any
mode to grant the YouTube permission (D16 — nothing runs until you do), then
walk these six pages in each of Deep Focus, Music and Light:

| Page | URL | Check |
|---|---|---|
| home | `youtube.com` | grid gone, placeholder shows, no flash on hard reload |
| watch | `youtube.com/watch?v=…` | sidebar gone, player widened, comments collapsed, end screen clear |
| search | `youtube.com/results?search_query=…` | results present, shelves and Shorts gone |
| subs | `youtube.com/feed/subscriptions` | behaves per mode, Shorts rows gone |
| channel | `youtube.com/@…` | Shorts tab gone, page otherwise intact |
| shorts | `youtube.com/shorts/…` | redirects to `/watch?v=…`, back button not stuck in a loop |

Then: no console errors anywhere; `Alt+Shift+Q` cycles modes; `Alt+Shift+P`
reveals for 30s and re-hides itself; options changes apply to an open YouTube
tab without a reload.

**No-flash check.** DevTools → Network → throttle to Fast 3G, hard-reload the
home page while screen recording, step through the frames. Zero frames should
show the recommendation grid. This is a headline claim — verify it, do not
assume it.

## Automated

Two suites. The offline one needs no network and must always be green:

```bash
npm install
npm run test        # offline: registry, storage, css engine, real extension load
npm run check       # the above plus the release gate
npm run test:live   # loads real youtube.com to verify selectors — run before a release
```

**offline** (~10s)

| File | What it proves |
|---|---|
| `tests/registry.spec.js` | every entry is well formed; handlers declared match handlers implemented; manifest permissions and content-script order are unchanged; no network code in `src/` |
| `tests/storage.spec.js` | mode → custom → override → peek layering, and every schedule edge case including windows that cross midnight |
| `tests/engine.spec.js` | the CSS engine hides a synthetic fixture built from each selector, page scoping keeps rules off the wrong page type, a corrupt cache degrades safely, `style:true` features filter rather than hide |
| `tests/extension.spec.js` | the real unpacked extension loads in Chromium, content scripts run, the default mode hides the home grid, the flags cache is written, nothing leaks into the page's main world |

`engine` and `extension` serve a page from the real `youtube.com` origin using
Playwright route fulfillment — locally generated, no request leaves the machine.
The real origin is needed because `about:blank` has no `localStorage`, which the
no-flash path depends on.

**live** (`tests/selectors.spec.js`) loads actual YouTube pages and asserts each
registry selector still matches something. It is excluded from `npm run test`
and from CI because it is network-dependent and rate-limited; run it locally
before every release, and whenever a user reports a toggle stopped working.

If Playwright cannot find a browser, point it at an existing one rather than
downloading:

```bash
PLAYWRIGHT_CHROMIUM_PATH=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1) npm run test
```

## A gotcha: `globalThis` pollution across spec files

Several offline spec files load real source via
`new Function(readFileSync(...))()` and assert on the `globalThis.QS` /
`globalThis.chrome` state that leaves behind — the same pattern that makes
these tests possible without a build step. Playwright reuses worker
processes across test files for speed, so `globalThis` is the literal same
object across whichever files land on the same worker: a file that runs
first can leave `globalThis.QS.packs` holding both packs, or `globalThis.chrome`
shaped for a different stub, by the time the next file's tests run.

Consequence: never write an assertion that assumes a pristine `globalThis`
("only youtube is loaded so far"). Reset the specific keys your test depends
on in a `beforeEach` instead (see `tests/storage.spec.js`'s "multi-pack
contexts" block), and restore them afterward if later tests in the same file
depend on the original shape.

## Quick static checks

```bash
# every JS file parses
for f in $(find src -name '*.js'); do node --check "$f" || echo "FAIL $f"; done

# no network code (a release blocker)
grep -rnE "fetch\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket" src/

# docs match the registry
node tools/gen-features.mjs && git diff --exit-code docs/FEATURES.md
```

## What is NOT covered yet

- **Selector accuracy against real YouTube.** The offline suite proves the
  engine applies the selectors correctly; it cannot prove the selectors are the
  right ones. `npm run test:live` is the only thing that does — see
  `docs/DECISIONS.md` D14 for the first run's findings and the `verified`
  registry field it led to.
- The behaviour handlers are only covered indirectly. `forceAutoplayOff` and
  `disableAmbient` depend on player internals (tier-3 selectors) and can only be
  verified by hand on a real watch page.
- Signed-in flows (subscriptions feed) are skipped.
- No visual regression testing. The no-flash claim is verified by hand.

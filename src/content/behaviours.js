/**
 * BEHAVIOURS — the small set of things CSS cannot do.
 *
 * Contract for every handler:
 *   - name it exactly the `handler` string in registry.js
 *   - signature: (ctx) => cleanupFn | void     ctx = { page, flags, cfg }
 *   - must be idempotent: main.js calls handlers again on every SPA navigation
 *   - must clean up after itself via the returned function
 *   - must tolerate its target not existing yet (YouTube hydrates lazily —
 *     use QT.dom.waitFor rather than assuming the node is there)
 *
 * Keep this file small. If you can express it in CSS, put it in the registry
 * as kind:'css' instead — CSS costs nothing at runtime and never breaks
 * YouTube's own scripts.
 */
(function () {
  const { waitFor, every, all } = globalThis.QT.dom;
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

    const guardKey = 'qt:redirected';
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

  // ── player ───────────────────────────────────────────────────────────────

  /**
   * Force the player's autoplay toggle off and keep it off.
   * YouTube re-enables it on navigation and sometimes after an ad break, so a
   * one-shot click is not enough. 2s is frequent enough that the user never
   * sees autoplay fire, and cheap enough to be invisible in a profile.
   */
  H.forceAutoplayOff = () =>
    every(2000, () => {
      const btn = document.querySelector('.ytp-autonav-toggle-button');
      if (btn && btn.getAttribute('aria-checked') === 'true') btn.click();
    });

  H.disableAmbient = () =>
    every(3000, () => {
      for (const el of document.querySelectorAll('#cinematics, .ytp-cinematics-container')) {
        el.style.display = 'none';
      }
    });

  /**
   * Pause playback when the tab loses focus; resume only what we paused.
   * Nobody else ships this, and it closes the "video kept playing while I
   * worked in another tab" hole that makes people think they are focused when
   * they are not.
   */
  H.pauseOnBlur = () => {
    const onChange = () => {
      const v = document.querySelector('video.html5-main-video');
      if (!v) return;
      if (document.hidden) {
        if (!v.paused) {
          v.pause();
          v.dataset.qtPaused = '1';
        }
      } else if (v.dataset.qtPaused === '1') {
        delete v.dataset.qtPaused;
        // Do NOT auto-resume: returning to the tab should not start noise.
        // The flag exists so a future "resume where you left off" option can
        // tell our pauses from the user's.
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  };

  // ── injected UI ──────────────────────────────────────────────────────────

  /**
   * Collapse comments behind a button instead of hiding them.
   *
   * Strictly better than hiding: the escape hatch means the user never
   * uninstalls the extension to read one comment (decision D8). Comments
   * hydrate long after navigation, hence waitFor.
   */
  H.collapseComments = () => {
    let undo = () => {};
    const cancel = waitFor('ytd-comments#comments', (root) => {
      if (root.dataset.qtCollapsed === '1') return;
      root.dataset.qtCollapsed = '1';
      root.style.display = 'none';

      const btn = document.createElement('button');
      btn.className = 'qt-reveal-btn';
      btn.type = 'button';
      btn.textContent = 'Show comments';
      btn.addEventListener('click', () => {
        root.style.display = '';
        delete root.dataset.qtCollapsed;
        btn.remove();
      });
      root.parentNode.insertBefore(btn, root);

      undo = () => {
        root.style.display = '';
        delete root.dataset.qtCollapsed;
        btn.remove();
      };
    });
    return all(cancel, () => undo());
  };

  /**
   * Replace the home feed with a prompt rather than blank space.
   * An empty page reads as broken; a question reads as intentional, and
   * reframes the visit from browsing to searching.
   */
  H.homePlaceholder = (ctx) => {
    let undo = () => {};
    const cancel = waitFor('ytd-browse[page-subtype="home"]', (host) => {
      if (document.getElementById('qt-placeholder')) return;

      const box = document.createElement('div');
      box.id = 'qt-placeholder';

      const text = document.createElement('p');
      text.className = 'qt-ph-text';
      text.textContent =
        (ctx && ctx.cfg && ctx.cfg.placeholderText) || 'What did you come here to watch?';

      box.append(text);
      host.prepend(box);
      undo = () => box.remove();
    });
    return all(cancel, () => undo());
  };

  globalThis.QT = Object.assign(globalThis.QT || {}, { behaviours: H });
})();

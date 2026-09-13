/**
 * CORE BEHAVIOURS — the one handler genuinely site-agnostic enough to live
 * here rather than in a pack. It touches only the standard <video> element,
 * never a site-specific selector.
 *
 * Contract for every handler (core or pack):
 *   - name it exactly the `handler` string in the registry entry
 *   - signature: (ctx) => cleanupFn | void     ctx = { page, flags, cfg }
 *   - must be idempotent: main.js calls handlers again on every SPA navigation
 *   - must clean up after itself via the returned function
 *   - must tolerate its target not existing yet
 */
(function () {
  const H = {};

  /**
   * Pause playback when the tab loses focus; resume only what we paused.
   * Works on any page with a <video> element, so this is the one handler that
   * belongs in core rather than a pack.
   */
  H.pauseOnBlur = () => {
    const onChange = () => {
      const v = document.querySelector('video');
      if (!v) return;
      if (document.hidden) {
        if (!v.paused) {
          v.pause();
          v.dataset.qsPaused = '1';
        }
      } else if (v.dataset.qsPaused === '1') {
        delete v.dataset.qsPaused;
        // Do NOT auto-resume: returning to the tab should not start noise.
        // The flag exists so a future "resume where you left off" option can
        // tell our pauses from the user's.
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  };

  globalThis.QS = Object.assign(globalThis.QS || {}, { behaviours: H });
})();

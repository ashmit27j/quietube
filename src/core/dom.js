/**
 * Small DOM helpers shared by every pack's behaviour handlers.
 *
 * The only place in this codebase where a MutationObserver is legitimate:
 * a site's own framework hydrates lazily, so a handler that runs on
 * navigation often fires before its target exists. `waitFor` observes a
 * NARROW subtree for a BOUNDED time and disconnects itself. Never observe the
 * whole document indefinitely — see docs/ARCHITECTURE.md.
 */
(function () {
  /**
   * Resolve when `selector` first matches, or give up.
   * @returns {function} cancel — always call it from your handler's cleanup.
   */
  function waitFor(selector, cb, opts = {}) {
    const { timeout = 10_000, root = document.documentElement } = opts;

    const existing = document.querySelector(selector);
    if (existing) {
      cb(existing);
      return () => {};
    }

    let done = false;
    const finish = (el) => {
      if (done) return;
      done = true;
      obs.disconnect();
      clearTimeout(timer);
      if (el) cb(el);
    };

    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) finish(el);
    });
    obs.observe(root, { childList: true, subtree: true });

    const timer = setTimeout(() => finish(null), timeout);

    return () => finish(null);
  }

  /** Run `fn` now and on every match for `selector` that appears later. */
  function onEach(selector, fn, opts = {}) {
    const { timeout = 15_000 } = opts;
    const seen = new WeakSet();
    const sweep = () => {
      for (const el of document.querySelectorAll(selector)) {
        if (seen.has(el)) continue;
        seen.add(el);
        try { fn(el); } catch (e) { console.warn('[QuietSurf] onEach', selector, e); }
      }
    };
    sweep();
    const obs = new MutationObserver(sweep);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    const timer = setTimeout(() => obs.disconnect(), timeout);
    return () => { obs.disconnect(); clearTimeout(timer); };
  }

  /** setInterval that is guaranteed to be cleared by the returned function. */
  function every(ms, fn) {
    fn();
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }

  /** Combine several cleanup functions into one. */
  function all(...fns) {
    return () => fns.forEach((f) => { try { f && f(); } catch {} });
  }

  globalThis.QS = Object.assign(globalThis.QS || {}, { dom: { waitFor, onEach, every, all } });
})();

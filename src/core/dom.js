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

  /**
   * Collapse an element behind a "reveal" button instead of hiding it
   * outright. Strictly better than hiding: the escape hatch means the user
   * never has to disable the whole extension to see the one thing it hid
   * (decision D8). Pulled into core after two packs both needed the exact
   * same choreography for their own comment sections — `selector` and the
   * button's copy/class are the only pack-specific parts (see D15).
   *
   * @param {string} selector - element to collapse (found via waitFor)
   * @param {object} opts
   * @param {string} opts.buttonClass - CSS class for the reveal button (the pack owns the styling)
   * @param {string} opts.buttonText - label shown on the button
   * @param {string} [opts.hiddenAttr] - dataset flag guarding idempotency (default 'qsCollapsed')
   * @returns {function} cleanup
   */
  function collapseWithReveal(selector, { buttonClass, buttonText, hiddenAttr = 'qsCollapsed' }) {
    let undo = () => {};
    const cancel = waitFor(selector, (root) => {
      if (root.dataset[hiddenAttr] === '1') return;
      root.dataset[hiddenAttr] = '1';
      root.style.display = 'none';

      const btn = document.createElement('button');
      btn.className = buttonClass;
      btn.type = 'button';
      btn.textContent = buttonText;
      btn.addEventListener('click', () => {
        root.style.display = '';
        delete root.dataset[hiddenAttr];
        btn.remove();
      });
      root.parentNode.insertBefore(btn, root);

      undo = () => {
        root.style.display = '';
        delete root.dataset[hiddenAttr];
        btn.remove();
      };
    });
    return all(cancel, () => undo());
  }

  globalThis.QS = Object.assign(globalThis.QS || {}, {
    dom: { waitFor, onEach, every, all, collapseWithReveal },
  });
})();

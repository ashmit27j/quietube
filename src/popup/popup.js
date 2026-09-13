(async function () {
  const QS = globalThis.QS;
  const pack = QS.pack;
  const MODES = ['off', ...Object.keys(pack.modes), 'custom'];
  const MODE_META = { off: QS.storage.OFF_META, ...pack.modes, custom: QS.storage.CUSTOM_META };

  const modesEl = document.getElementById('modes');
  const blurbEl = document.getElementById('blurb');
  const peekEl = document.getElementById('peek');

  let cfg = await QS.storage.load();

  function render() {
    const active = QS.storage.activeMode(cfg);
    modesEl.replaceChildren(
      ...MODES.filter((m) => m !== 'custom' || Object.keys(cfg.custom || {}).length).map((m) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.role = 'radio';
        b.textContent = MODE_META[m].label;
        b.setAttribute('aria-checked', String(m === active));
        b.addEventListener('click', async () => {
          cfg.mode = m;
          await QS.storage.save({ mode: m, peekUntil: 0 });
          render();
        });
        b.addEventListener('mouseenter', () => { blurbEl.textContent = MODE_META[m].blurb; });
        b.addEventListener('mouseleave', () => { blurbEl.textContent = MODE_META[active].blurb; });
        return b;
      })
    );
    blurbEl.textContent = MODE_META[active].blurb;

    const peeking = (cfg.peekUntil || 0) > Date.now();
    peekEl.dataset.active = peeking ? '1' : '0';
    peekEl.textContent = peeking ? 'End peek' : 'Peek for 30s';

    if (cfg.schedule?.enabled && active !== cfg.mode) {
      blurbEl.textContent = `Scheduled: ${MODE_META[active].label} is active right now. ${MODE_META[active].blurb}`;
    }
  }

  peekEl.addEventListener('click', async () => {
    const peeking = (cfg.peekUntil || 0) > Date.now();
    cfg.peekUntil = peeking ? 0 : Date.now() + 30_000;
    await QS.storage.save({ peekUntil: cfg.peekUntil });
    render();
  });

  document.getElementById('open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  chrome.storage.onChanged.addListener(async () => {
    cfg = await QS.storage.load();
    render();
  });

  render();
})();

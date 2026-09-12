(async function () {
  const QT = globalThis.QT;
  const modesEl = document.getElementById('modes');
  const blurbEl = document.getElementById('blurb');
  const peekEl = document.getElementById('peek');

  let cfg = await QT.storage.load();

  function render() {
    const active = QT.storage.activeMode(cfg);
    modesEl.replaceChildren(
      ...QT.MODES.filter((m) => m !== 'custom' || Object.keys(cfg.custom || {}).length).map((m) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.role = 'radio';
        b.textContent = QT.MODE_META[m].label;
        b.setAttribute('aria-checked', String(m === active));
        b.addEventListener('click', async () => {
          cfg.mode = m;
          await QT.storage.save({ mode: m, peekUntil: 0 });
          render();
        });
        b.addEventListener('mouseenter', () => { blurbEl.textContent = QT.MODE_META[m].blurb; });
        b.addEventListener('mouseleave', () => { blurbEl.textContent = QT.MODE_META[active].blurb; });
        return b;
      })
    );
    blurbEl.textContent = QT.MODE_META[active].blurb;

    const peeking = (cfg.peekUntil || 0) > Date.now();
    peekEl.dataset.active = peeking ? '1' : '0';
    peekEl.textContent = peeking ? 'End peek' : 'Peek for 30s';

    if (cfg.schedule?.enabled && active !== cfg.mode) {
      blurbEl.textContent = `Scheduled: ${QT.MODE_META[active].label} is active right now. ${QT.MODE_META[active].blurb}`;
    }
  }

  peekEl.addEventListener('click', async () => {
    const peeking = (cfg.peekUntil || 0) > Date.now();
    cfg.peekUntil = peeking ? 0 : Date.now() + 30_000;
    await QT.storage.save({ peekUntil: cfg.peekUntil });
    render();
  });

  document.getElementById('open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  chrome.storage.onChanged.addListener(async () => {
    cfg = await QT.storage.load();
    render();
  });

  render();
})();

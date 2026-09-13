/**
 * Popup — progressive disclosure. Master kill switch and the current site's
 * name always show; everything else depends on whether the current tab
 * matches a pack this extension knows about.
 *
 * Loads every known pack (see popup.html) rather than just one, since the
 * popup has to work on whichever site the user happens to have open — see
 * docs/ARCHITECTURE.md "Adding a pack" for why that's a static script list
 * here rather than something discovered at runtime.
 */
(async function () {
  const QS = globalThis.QS;
  const { matchPattern } = globalThis.QSBackground;
  const REPO_ISSUES_URL = 'https://github.com/ashmit27j/quietube/issues/new';

  const masterToggle = document.getElementById('master-toggle');
  const siteNameEl = document.getElementById('site-name');
  const siteView = document.getElementById('site-view');
  const unsupportedView = document.getElementById('unsupported-view');
  const modesEl = document.getElementById('modes');
  const blurbEl = document.getElementById('blurb');
  const quickEl = document.getElementById('quick');
  const peekEl = document.getElementById('peek');
  const requestPackEl = document.getElementById('request-pack');

  let cfg = await QS.storage.load();
  const packs = QS.storage.knownPacks();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab?.url || '';
  const activePack = packs.find((p) => p.hosts.some((h) => matchPattern(h, tabUrl)));

  let site = activePack ? cfg.sites[activePack.id] : null;
  const MODES = activePack ? ['off', ...Object.keys(activePack.modes), 'custom'] : [];
  const MODE_META = activePack
    ? { off: QS.storage.OFF_META, ...activePack.modes, custom: QS.storage.CUSTOM_META }
    : {};

  function hostnameOf(url) {
    try { return new URL(url).hostname; } catch { return 'this site'; }
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
    window.close();
  }

  function renderQuick(currentMode) {
    quickEl.replaceChildren();
    const ids = site.quick || [];
    if (!ids.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = 'Settings';
      link.addEventListener('click', (e) => { e.preventDefault(); openOptions(); });
      p.append('No quick toggles yet — add some from ', link, '.');
      quickEl.append(p);
      return;
    }

    const { flags } = QS.storage.resolve(cfg, Date.now(), activePack);
    for (const id of ids) {
      const f = activePack.features.find((x) => x.id === id);
      if (!f) continue; // a quick id whose feature no longer exists — skip quietly

      const row = document.createElement('div');
      row.className = 'row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `quick-${id}`;
      input.checked = !!flags[id];
      input.addEventListener('change', async () => {
        site.overrides = site.overrides || {};
        site.overrides[id] = input.checked;
        await QS.storage.save({ sites: cfg.sites });
        render();
      });
      const label = document.createElement('label');
      label.htmlFor = input.id;
      label.textContent = f.label;
      row.append(input, label);
      quickEl.append(row);
    }
  }

  async function onPickMode(m) {
    // D16: the pack is inert until its host permission is granted. Ask the
    // first time the user picks anything other than Off — this click is the
    // user gesture chrome.permissions.request() requires. The service
    // worker's onAdded listener registers and injects the pack once granted.
    if (m !== 'off') {
      const already = await chrome.permissions.contains({ origins: activePack.hosts });
      if (!already) {
        const granted = await chrome.permissions.request({ origins: activePack.hosts }).catch(() => false);
        if (!granted) return; // declined — leave the mode untouched
      }
    }
    site.mode = m;
    await QS.storage.save({ sites: cfg.sites, peekUntil: 0 });
    render();
  }

  function render() {
    masterToggle.checked = cfg.masterEnabled !== false;

    if (!activePack) {
      siteNameEl.textContent = hostnameOf(tabUrl);
      siteView.hidden = true;
      unsupportedView.hidden = false;
      peekEl.hidden = true;
      requestPackEl.href =
        `${REPO_ISSUES_URL}?title=${encodeURIComponent(`Add a pack for ${hostnameOf(tabUrl)}`)}`;
      return;
    }

    siteNameEl.textContent = activePack.label;
    siteView.hidden = false;
    unsupportedView.hidden = true;
    peekEl.hidden = false;

    const active = QS.storage.activeMode(cfg, Date.now(), activePack);
    modesEl.replaceChildren(
      ...MODES.filter((m) => m !== 'custom' || Object.keys(site.custom || {}).length).map((m) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.role = 'radio';
        b.textContent = MODE_META[m].label;
        b.setAttribute('aria-checked', String(m === active));
        b.addEventListener('click', () => onPickMode(m));
        b.addEventListener('mouseenter', () => { blurbEl.textContent = MODE_META[m].blurb; });
        b.addEventListener('mouseleave', () => { blurbEl.textContent = MODE_META[active].blurb; });
        return b;
      })
    );
    blurbEl.textContent = MODE_META[active].blurb;
    if (cfg.schedule?.enabled && active !== site.mode) {
      blurbEl.textContent = `Scheduled: ${MODE_META[active].label} is active right now. ${MODE_META[active].blurb}`;
    }

    renderQuick(active);

    const peeking = (cfg.peekUntil || 0) > Date.now();
    peekEl.dataset.active = peeking ? '1' : '0';
    peekEl.textContent = peeking ? 'End peek' : 'Peek for 30s';
  }

  masterToggle.addEventListener('change', async () => {
    cfg.masterEnabled = masterToggle.checked;
    await QS.storage.save({ masterEnabled: cfg.masterEnabled });
    render();
  });

  peekEl.addEventListener('click', async () => {
    const peeking = (cfg.peekUntil || 0) > Date.now();
    cfg.peekUntil = peeking ? 0 : Date.now() + 30_000;
    await QS.storage.save({ peekUntil: cfg.peekUntil });
    render();
  });

  document.getElementById('open-options').addEventListener('click', openOptions);

  chrome.storage.onChanged.addListener(async () => {
    cfg = await QS.storage.load();
    if (activePack) site = cfg.sites[activePack.id];
    render();
  });

  render();
})();

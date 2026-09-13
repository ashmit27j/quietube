/**
 * Options page. Every control here is GENERATED from each known pack's
 * registry — adding a feature to a pack makes it appear here automatically,
 * with no edit to this file. That is the point of the registry; keep it that
 * way. Grouped by site (see options.html, which loads every pack) rather
 * than the single-pack rendering this file used before step 6.
 */
(async function () {
  const QS = globalThis.QS;
  const packs = QS.storage.knownPacks();
  let cfg = await QS.storage.load();

  const $ = (id) => document.getElementById(id);
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Which site cards are expanded. Not persisted — every card starts
  // collapsed on open, and this only needs to survive re-renders triggered
  // by the user's own clicks within this one page session.
  const expanded = new Set();

  // Small, self-drawn identification marks — not a copy of any site's
  // official vector asset — so a card is recognisable at a glance. Scoped to
  // this settings page only; the extension's own store icon/wordmark in
  // brand/ stays the neutral wave/ring mark (see docs/DECISIONS.md D19,
  // which supersedes D18's letter-badge choice for this one use). A pack
  // with no entry here falls back to its initial letter, so adding a pack
  // never requires touching this file to stay presentable.
  const ICON_SVG = {
    youtube:
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect width="24" height="24" rx="6" fill="#FF0000"/>' +
      '<path d="M9.8 7.6v8.8L16.8 12z" fill="#fff"/></svg>',
    reddit:
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="12" fill="#FF4500"/>' +
      '<circle cx="12" cy="6.6" r="1.25" fill="#fff"/>' +
      '<line x1="12" y1="7.8" x2="12" y2="9.4" stroke="#fff" stroke-width="1"/>' +
      '<ellipse cx="12" cy="14.1" rx="6.4" ry="4.5" fill="#fff"/>' +
      '<circle cx="9" cy="13.5" r="1.1" fill="#FF4500"/>' +
      '<circle cx="15" cy="13.5" r="1.1" fill="#FF4500"/>' +
      '<path d="M9 16.1c.9.75 1.9 1.05 3 1.05s2.1-.3 3-1.05" stroke="#FF4500" stroke-width="0.9" fill="none" stroke-linecap="round"/></svg>',
    linkedin:
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect width="24" height="24" rx="4" fill="#0A66C2"/>' +
      '<circle cx="7.4" cy="7.1" r="1.6" fill="#fff"/>' +
      '<rect x="6.1" y="9.9" width="2.6" height="8.1" fill="#fff"/>' +
      '<path d="M11.1 9.9h2.5v1.4h.04c.35-.66 1.2-1.36 2.47-1.36 2.64 0 3.13 1.74 3.13 4v5.02h-2.6v-4.45c0-1.06-.02-2.42-1.47-2.42-1.48 0-1.7 1.15-1.7 2.34v4.53h-2.6V9.9z" fill="#fff"/></svg>',
  };

  function renderLogo(pack) {
    const logo = document.createElement('div');
    logo.setAttribute('aria-hidden', 'true');
    const icon = ICON_SVG[pack.id];
    if (icon) {
      logo.className = 'site-logo has-icon';
      logo.innerHTML = icon;
    } else {
      logo.className = 'site-logo';
      logo.textContent = pack.label.trim().charAt(0).toUpperCase();
    }
    return logo;
  }

  async function persistSites() {
    await QS.storage.save({ sites: cfg.sites });
  }

  // ── master switch ───────────────────────────────────────────────────────
  const masterToggle = $('master-toggle');
  masterToggle.checked = cfg.masterEnabled !== false;
  masterToggle.addEventListener('change', async () => {
    cfg.masterEnabled = masterToggle.checked;
    await QS.storage.save({ masterEnabled: cfg.masterEnabled });
  });

  // ── one card per known pack ─────────────────────────────────────────────
  function renderSites() {
    const host = $('sites');
    host.replaceChildren();

    for (const pack of packs) {
      const site = cfg.sites[pack.id];
      const MODES = ['off', ...Object.keys(pack.modes), 'custom'];
      const MODE_META = { off: QS.storage.OFF_META, ...pack.modes, custom: QS.storage.CUSTOM_META };
      const active = QS.storage.activeMode(cfg, Date.now(), pack);
      const { flags } = QS.storage.resolve(cfg, Date.now(), pack);

      const card = document.createElement('section');
      card.className = 'card site-card';
      const isExpanded = expanded.has(pack.id);

      const head = document.createElement('div');
      head.className = 'site-head';

      const left = document.createElement('div');
      left.className = 'site-head-left';

      const logo = renderLogo(pack);
      const h2 = document.createElement('h2');
      h2.textContent = pack.label;
      left.append(logo, h2);

      const expandBtn = document.createElement('button');
      expandBtn.type = 'button';
      expandBtn.className = 'expand-btn';
      expandBtn.setAttribute('aria-expanded', String(isExpanded));
      expandBtn.setAttribute('aria-label', `${isExpanded ? 'Collapse' : 'Expand'} ${pack.label} toggles`);
      expandBtn.textContent = '▸';
      expandBtn.onclick = () => {
        if (isExpanded) expanded.delete(pack.id);
        else expanded.add(pack.id);
        renderSites();
      };

      head.append(left, expandBtn);
      card.append(head);

      // modes
      const modesEl = document.createElement('div');
      modesEl.className = 'modes';
      modesEl.setAttribute('role', 'radiogroup');
      modesEl.setAttribute('aria-label', `${pack.label} mode`);
      for (const m of MODES) {
        if (m === 'custom' && !Object.keys(site.custom || {}).length) continue;
        const b = document.createElement('button');
        b.type = 'button';
        b.role = 'radio';
        b.textContent = MODE_META[m].label;
        b.title = MODE_META[m].blurb;
        b.setAttribute('aria-checked', String(m === active));
        b.onclick = async () => {
          // D16: the pack is inert until its host permission is granted. Ask
          // the first time the user picks anything other than Off for it.
          if (m !== 'off') {
            const already = await chrome.permissions.contains({ origins: pack.hosts });
            if (!already) {
              const granted = await chrome.permissions.request({ origins: pack.hosts }).catch(() => false);
              if (!granted) return;
            }
          }
          site.mode = m;
          await persistSites();
          renderAll();
        };
        modesEl.append(b);
      }
      card.append(modesEl);

      const overrideCount = Object.keys(site.overrides || {}).length;
      if (overrideCount) {
        const note = document.createElement('p');
        note.className = 'note';
        const clearBtn = document.createElement('button');
        clearBtn.className = 'linkbtn';
        clearBtn.textContent = 'Clear overrides';
        clearBtn.onclick = async () => {
          site.overrides = {};
          await persistSites();
          renderAll();
        };
        note.append(`${overrideCount} override(s) active. `, clearBtn);
        card.append(note);
      }

      // feature toggles, grouped — collapsed by default (see `expanded` above)
      const groupsHost = document.createElement('div');
      groupsHost.className = 'groups';
      groupsHost.hidden = !isExpanded;
      for (const g of pack.groups) {
        const items = pack.features.filter((f) => f.group === g.id);
        if (!items.length) continue;

        const block = document.createElement('div');
        block.className = 'group-block';
        const h3 = document.createElement('h3');
        h3.textContent = g.label;
        const gp = document.createElement('p');
        gp.className = 'muted';
        gp.textContent = g.blurb;
        block.append(h3, gp);

        for (const f of items) {
          const row = document.createElement('div');
          row.className = 'feat';
          row.dataset.overridden = f.id in (site.overrides || {}) ? '1' : '0';

          const sw = document.createElement('label');
          sw.className = 'sw';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = !!flags[f.id];
          input.setAttribute('aria-label', f.label);
          input.onchange = async () => {
            site.overrides = site.overrides || {};
            site.overrides[f.id] = input.checked;
            await persistSites();
            renderAll();
          };
          sw.append(input, document.createElement('span'));

          const txt = document.createElement('div');
          txt.className = 'txt';
          const label = document.createElement('div');
          label.className = 'label';
          label.textContent = f.label;
          if (f.risk === 'high') {
            const r = document.createElement('span');
            r.className = 'risk';
            r.textContent = 'fragile';
            r.title = 'Depends on a class name — most likely toggle to break after a redesign.';
            label.append(r);
          }
          if (f.verified === 'needs-account') {
            const r = document.createElement('span');
            r.className = 'risk';
            r.textContent = 'needs account';
            r.title = 'Only exists when signed in — the live selector audit cannot verify this from a signed-out browser.';
            label.append(r);
          }
          const desc = document.createElement('div');
          desc.className = 'desc';
          desc.textContent = f.desc;
          txt.append(label, desc);

          row.append(sw, txt);
          block.append(row);
        }
        groupsHost.append(block);
      }
      card.append(groupsHost);
      host.append(card);
    }
  }

  // ── schedule ─────────────────────────────────────────────────────────────
  // Global, not per-site (see docs/ARCHITECTURE.md): one set of time windows
  // applies across every site. Its mode dropdown necessarily comes from ONE
  // pack's vocabulary — the first known pack, by the same convention
  // core/storage.js's schema-1 migration uses (see docs/DECISIONS.md D17).
  const schedulePack = packs[0];
  $('sched-pack-name').textContent = schedulePack.label;
  $('sched-pack-logo').append(renderLogo(schedulePack));
  const SCHED_MODES = ['off', ...Object.keys(schedulePack.modes), 'custom'];
  const SCHED_MODE_META = { off: QS.storage.OFF_META, ...schedulePack.modes, custom: QS.storage.CUSTOM_META };
  const schedDefaultMode = Object.keys(schedulePack.modes).at(-1); // the pack's own most-aggressive mode

  function renderSchedule() {
    const s = (cfg.schedule = cfg.schedule || { enabled: false, rules: [] });
    $('sched-enabled').checked = !!s.enabled;

    const host = $('sched-rules');
    host.replaceChildren();
    s.rules.forEach((rule, i) => {
      const row = document.createElement('div');
      row.className = 'sched-rule';

      const days = document.createElement('div');
      days.className = 'days';
      DAYS.forEach((d, di) => {
        const l = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = (rule.days || []).includes(di);
        cb.onchange = () => {
          rule.days = rule.days || [];
          if (cb.checked) rule.days.push(di);
          else rule.days = rule.days.filter((x) => x !== di);
          persistSchedule();
        };
        const sp = document.createElement('span');
        sp.textContent = d;
        l.append(cb, sp);
        days.append(l);
      });

      const from = document.createElement('input');
      from.type = 'time';
      from.value = rule.from || '09:00';
      from.onchange = () => { rule.from = from.value; persistSchedule(); };

      const to = document.createElement('input');
      to.type = 'time';
      to.value = rule.to || '17:00';
      to.onchange = () => { rule.to = to.value; persistSchedule(); };

      const sel = document.createElement('select');
      SCHED_MODES.forEach((m) => {
        const o = document.createElement('option');
        o.value = m;
        o.textContent = SCHED_MODE_META[m].label;
        o.selected = rule.mode === m;
        sel.append(o);
      });
      sel.onchange = () => { rule.mode = sel.value; persistSchedule(); };

      const del = document.createElement('button');
      del.className = 'linkbtn';
      del.textContent = 'Remove';
      del.onclick = () => { s.rules.splice(i, 1); persistSchedule(); renderAll(); };

      row.append(days, from, document.createTextNode('→'), to, sel, del);
      host.append(row);
    });
  }

  async function persistSchedule() {
    await QS.storage.save({ schedule: cfg.schedule });
    renderSites();
  }

  $('sched-enabled').onchange = async (e) => {
    cfg.schedule.enabled = e.target.checked;
    await persistSchedule();
  };

  $('sched-add').onclick = async () => {
    cfg.schedule.rules.push({ days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00', mode: schedDefaultMode });
    await persistSchedule();
    renderAll();
  };

  // ── backup ──────────────────────────────────────────────────────────────
  // A backed-up file is one JSON blob covering every known pack at once, not
  // a per-site export — show which sites that covers.
  const backupSitesHost = $('backup-sites');
  for (const pack of packs) {
    const chip = document.createElement('span');
    chip.className = 'backup-chip';
    chip.append(document.createTextNode(pack.label));
    backupSitesHost.append(chip);
  }

  $('export').onclick = () => {
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'quietsurf-settings.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  $('import').onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json';
    inp.onchange = async () => {
      const text = await inp.files[0].text();
      try {
        const incoming = JSON.parse(text);
        await QS.storage.save(incoming);
        cfg = await QS.storage.load();
        renderAll();
      } catch {
        alert('That file is not valid QuietSurf settings.');
      }
    };
    inp.click();
  };

  $('reset').onclick = async () => {
    if (!confirm('Reset every setting to defaults?')) return;
    await (chrome.storage.sync || chrome.storage.local).clear();
    await QS.storage.save(QS.storage.DEFAULTS);
    cfg = await QS.storage.load();
    renderAll();
  };

  function renderAll() {
    masterToggle.checked = cfg.masterEnabled !== false;
    renderSites();
    renderSchedule();
  }

  renderAll();
})();

/**
 * Options page. Every control here is GENERATED from src/lib/registry.js —
 * adding a feature to the registry makes it appear here automatically, with
 * no edit to this file. That is the point of the registry; keep it that way.
 */
(async function () {
  const QT = globalThis.QT;
  let cfg = await QT.storage.load();

  const $ = (id) => document.getElementById(id);
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // ── modes ───────────────────────────────────────────────────────────────
  function renderModes() {
    const active = QT.storage.activeMode(cfg);
    $('modes').replaceChildren(
      ...QT.MODES.map((m) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.role = 'radio';
        b.textContent = QT.MODE_META[m].label;
        b.title = QT.MODE_META[m].blurb;
        b.setAttribute('aria-checked', String(m === active));
        b.onclick = async () => {
          cfg.mode = m;
          await QT.storage.save({ mode: m });
          renderAll();
        };
        return b;
      })
    );

    const n = Object.keys(cfg.overrides || {}).length;
    $('override-note').hidden = n === 0;
    $('override-count').textContent = String(n);
  }

  $('clear-overrides').onclick = async () => {
    cfg.overrides = {};
    await QT.storage.save({ overrides: {} });
    renderAll();
  };

  // ── feature toggles ─────────────────────────────────────────────────────
  function renderFeatures() {
    const { flags } = QT.storage.resolve(cfg);
    const host = $('features');
    host.replaceChildren();

    for (const g of QT.GROUPS) {
      const items = QT.REGISTRY.filter((f) => f.group === g.id);
      if (!items.length) continue;

      const card = document.createElement('section');
      card.className = 'card';
      card.innerHTML = `<h2></h2><p class="muted"></p>`;
      card.querySelector('h2').textContent = g.label;
      card.querySelector('.muted').textContent = g.blurb;

      for (const f of items) {
        const row = document.createElement('div');
        row.className = 'feat';
        row.dataset.overridden = f.id in (cfg.overrides || {}) ? '1' : '0';

        const sw = document.createElement('label');
        sw.className = 'sw';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!flags[f.id];
        input.setAttribute('aria-label', f.label);
        input.onchange = async () => {
          cfg.overrides = cfg.overrides || {};
          cfg.overrides[f.id] = input.checked;
          await QT.storage.save({ overrides: cfg.overrides });
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
          r.title = 'Depends on a YouTube class name — most likely toggle to break after a YouTube redesign.';
          label.append(r);
        }
        const desc = document.createElement('div');
        desc.className = 'desc';
        desc.textContent = f.desc;
        txt.append(label, desc);

        row.append(sw, txt);
        card.append(row);
      }
      host.append(card);
    }
  }

  // ── schedule ────────────────────────────────────────────────────────────
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
      QT.MODES.forEach((m) => {
        const o = document.createElement('option');
        o.value = m;
        o.textContent = QT.MODE_META[m].label;
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
    await QT.storage.save({ schedule: cfg.schedule });
    renderModes();
  }

  $('sched-enabled').onchange = async (e) => {
    cfg.schedule.enabled = e.target.checked;
    await persistSchedule();
  };

  $('sched-add').onclick = async () => {
    cfg.schedule.rules.push({ days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00', mode: 'study' });
    await persistSchedule();
    renderAll();
  };

  // ── backup ──────────────────────────────────────────────────────────────
  $('export').onclick = () => {
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'quiet-settings.json';
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
        await QT.storage.save(incoming);
        cfg = await QT.storage.load();
        renderAll();
      } catch {
        alert('That file is not valid Quiet settings.');
      }
    };
    inp.click();
  };

  $('reset').onclick = async () => {
    if (!confirm('Reset every setting to defaults?')) return;
    await (chrome.storage.sync || chrome.storage.local).clear();
    await QT.storage.save(QT.storage.DEFAULTS);
    cfg = await QT.storage.load();
    renderAll();
  };

  function renderAll() {
    renderModes();
    renderSchedule();
    renderFeatures();
  }

  renderAll();
})();

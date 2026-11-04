// piesen.js — zobrazenie piesne: metadáta, prehrávanie, prepínač roly
// (Basista / Kontráš / Oboje) a nástroja kontry (viola / husle), hmaty ku každému akordu.
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  const DIFF = {
    zaciatocnik: { label: 'Začiatočník', cls: 'teal' },
    mierne: { label: 'Mierne pokročilý', cls: 'amber' },
    pokrocily: { label: 'Pokročilý', cls: 'coral' }
  };

  const id = new URLSearchParams(location.search).get('id');
  const song = id ? Store.get(id) : null;
  if (!song) { $('notfound').hidden = false; return; }

  const state = { role: 'kontras', inst: 'viola' };
  const parsed = Store.flatChords(song).map(function (t) { return Theory.parseChord(t); }).filter(Boolean);

  function keyDisplay(k) { const o = Theory.getKey(k); return o ? o.display : k; }

  // ---- hlavička ----
  function renderHead() {
    document.title = (song.title || 'Pieseň') + ' — Harmonizácia';
    $('title').textContent = song.title || 'Bez názvu';
    $('edit').href = 'editor.html?id=' + encodeURIComponent(song.id);
    const meta = $('meta');
    meta.innerHTML = '';
    const add = function (text, cls) { if (text) meta.appendChild(el('span', 'pill' + (cls ? ' ' + cls : ''), text)); };
    add(keyDisplay(song.key), 'mono');
    add(song.timeSig, 'mono');
    add((song.tempo || 104) + ' BPM', 'mono');
    add(song.style);
    add(song.region);
    const d = DIFF[song.difficulty];
    if (d) add(d.label, d.cls);
  }

  // ---- hmaty ----
  function renderGrid() {
    const grid = $('grid');
    grid.innerHTML = '';
    $('instWrap').style.visibility = state.role === 'basista' ? 'hidden' : 'visible';
    const instName = state.inst === 'husle' ? 'husle' : 'viola';
    $('secLabel').textContent = state.role === 'basista'
      ? 'Basová linka · kontrabas, 1. poloha'
      : (state.role === 'kontras'
        ? 'Kontra linka · dvojhmaty v 1. polohe (' + instName + ')'
        : 'Bas aj kontra · kontrabas + ' + instName);

    if (!parsed.length) {
      grid.appendChild(el('p', 'hint', 'Pieseň zatiaľ nemá žiadne akordy. Pridaj ich v editore.'));
      return;
    }
    const bassLine = Bass.computeLine(parsed);
    const kontraLine = Kontra.computeLine(parsed, state.inst);

    parsed.forEach(function (ch, i) {
      const card = el('article', 'm-card');
      card.appendChild(el('div', 'ch', ch.token));
      const b = bassLine[i];
      const k = kontraLine[i];
      const basName = b && b.bass[0] ? b.bass[0].note || b.bass[0].name : '–';

      if (state.role !== 'basista' && k) {
        card.appendChild(Fingerboard.render(state.inst, k.dvojhmat));
        card.appendChild(el('div', 'lab kon', 'kontra ' + k.dvojhmat.map(function (n) { return n.note; }).join('–')));
      }
      if (state.role !== 'kontras' && b) {
        card.appendChild(Fingerboard.render('kontrabas', b.bass));
      }
      card.appendChild(el('div', 'lab bas', 'bas ' + basName));
      grid.appendChild(card);
    });
  }

  // ---- prepínače ----
  function wireSeg(segId, key) {
    $(segId).addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-v]');
      if (!btn) return;
      state[key] = btn.getAttribute('data-v');
      $(segId).querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === btn ? 'true' : 'false'); });
      renderGrid();
    });
  }

  // ---- prehrávanie ----
  $('play').addEventListener('click', function () {
    if (!parsed.length) return;
    Sound.playProgression(parsed, { bpm: song.tempo || 104, mode: state.role === 'basista' ? 'bass' : 'band' });
  });
  $('stop').addEventListener('click', function () { Sound.stop(); });

  // ---- zdieľanie / stiahnutie ----
  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  $('share').addEventListener('click', function () {
    const url = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast('Odkaz skopírovaný'); }, function () { toast('Odkaz: ' + url); });
    } else { toast('Odkaz: ' + url); }
  });
  $('download').addEventListener('click', function () {
    const blob = new Blob([JSON.stringify(song, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const slug = (song.title || 'piesen').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.href = URL.createObjectURL(blob);
    a.download = (slug || 'piesen') + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    toast('Pieseň stiahnutá ako .json');
  });

  wireSeg('role', 'role');
  wireSeg('inst', 'inst');
  renderHead();
  renderGrid();
  $('song').hidden = false;
})();

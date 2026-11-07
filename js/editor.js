// editor.js — tvorba/úprava piesne: metadáta, paleta akordov, takty s políčkami
// (počet políčok = počet dôb podľa metra), prehrávanie úseku, náhľad bas/kontra, uloženie.
// Políčko sa dá kedykoľvek prepísať alebo vymazať — prázdne políčko ostane a znamená
// „pokračuje predchádzajúci akord" (akord len v 1. políčku platí pre celý takt).
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

  const params = new URLSearchParams(location.search);
  const editId = params.get('id');

  const state = {
    song: editId && window.Store ? (Store.get(editId) || Store.blank()) : Store.blank(),
    active: 0,      // začiatok úseku na prehrávanie
    rangeEnd: null, // koniec úseku (null = až do konca piesne)
    focus: null,    // posledné políčko s kurzorom {t, s} — sem píše paleta
    loop: false,
    playing: false
  };
  if (!state.song.bars || !state.song.bars.length) state.song.bars = [{ chords: [] }];
  Store.normalizeSlots(state.song);
  state.active = 0;

  function slots() { return Store.slotsFor(state.song.timeSig); }

  // ---- tokeny akordov z objektu (pre paletu) ----
  function tokenOf(ch) {
    const root = ch.notes[0].name;
    switch (ch.quality) {
      case 'mol': return root.toLowerCase();
      case 'dur7': return root + '7';
      case 'dim': return root + '0';
      default: return root;
    }
  }

  // ---- polia ----
  function fillKeys() {
    const sel = $('edKey');
    Theory.KEYS.forEach(function (k) {
      const o = document.createElement('option');
      o.value = k.id; o.textContent = k.display;
      sel.appendChild(o);
    });
    [['edAccomp', Store.ACCOMP], ['edArtic', Store.ARTIC], ['edLengths', Store.LENGTHS]].forEach(function (p) {
      p[1].forEach(function (a) {
        const o = document.createElement('option');
        o.value = a.id; o.textContent = a.label;
        $(p[0]).appendChild(o);
      });
    });
  }
  // Popis štýlu + zobrazenie len tých volieb, ktoré sa štýlu týkajú.
  function showAccompDesc() {
    const id = $('edAccomp').value;
    const a = Store.ACCOMP.find(function (x) { return x.id === id; });
    $('edAccompDesc').textContent = a ? a.desc : '';
    $('articField').hidden = !(id === 'estam' || id === 'valcik');
    fillAccents(id);
    syncLengths(id);
    showArticNow();
  }
  // Dĺžky osmín — len pri osminovom duvaji.
  function syncLengths(styleId) {
    const show = styleId === 'duvaj8';
    $('lengthsField').hidden = !show;
    if (!show) return;
    state.song.lengths = Store.lengthsOf(Object.assign({}, state.song, { accomp: styleId }));
    $('edLengths').value = state.song.lengths;
  }
  // Voľby prízvukovania pre zvolený štýl (osminový / štvrťový duvaj má každý iné).
  function fillAccents(styleId) {
    const list = Store.ACCENTS[styleId];
    const sel = $('edAccent');
    sel.innerHTML = '';
    $('accentField').hidden = !list;
    if (!list) return;
    list.forEach(function (a) {
      const o = document.createElement('option');
      o.value = a.id; o.textContent = a.label;
      sel.appendChild(o);
    });
    state.song.accent = Store.accentOf(Object.assign({}, state.song, { accomp: styleId }));
    sel.value = state.song.accent;
  }
  function showArticNow() {
    const bpm = +$('edTempo').value || 104;
    const now = Store.resolveArtic($('edArtic').value, bpm);
    const lab = Store.ARTIC.find(function (x) { return x.id === now; });
    $('edArticNow').textContent = $('edArtic').value === 'auto'
      ? 'Pri tempe ' + bpm + ' BPM: ' + (lab ? lab.label.split(' — ')[0].toLowerCase() : now) + '.'
      : '';
  }
  function loadFields() {
    const s = state.song;
    $('edTitle').value = s.title || '';
    $('edKey').value = s.key || 'C-dur';
    $('edTime').value = s.timeSig || '2/4';
    s.accomp = Store.accompOf(s);
    s.artic = s.artic || 'auto';
    $('edAccomp').value = s.accomp;
    $('edArtic').value = s.artic;
    $('edTempo').value = s.tempo || 104;
    $('edStyle').value = s.style || '';
    $('edRegion').value = s.region || '';
    $('edDiff').value = s.difficulty || 'zaciatocnik';
    $('edVideo').value = s.videoUrl || '';
    $('edHeading').textContent = editId ? 'Upraviť skladbu' : 'Editor skladby';
    showAccompDesc();
  }
  function bindFields() {
    $('edKey').addEventListener('change', function () { state.song.key = $('edKey').value; buildPalette(); });
    $('edTime').addEventListener('change', function () {
      state.song.timeSig = $('edTime').value;
      Store.normalizeSlots(state.song);
      renderBars(); renderPreview();
    });
    $('edAccomp').addEventListener('change', function () {
      state.song.accomp = $('edAccomp').value;
      state.song.accent = ''; // nový štýl = jeho predvolené prízvukovanie aj dĺžky
      state.song.lengths = '';
      showAccompDesc();
      if (state.playing) play(); // počuť zmenu hneď
    });
    $('edArtic').addEventListener('change', function () {
      state.song.artic = $('edArtic').value; showArticNow();
      if (state.playing) play();
    });
    $('edAccent').addEventListener('change', function () {
      state.song.accent = $('edAccent').value;
      // dĺžky sa prispôsobia prízvuku (2222 → rovnaké, inak prvá kratšia); dajú sa zmeniť
      state.song.lengths = Store.defaultLengths(state.song.accent);
      $('edLengths').value = state.song.lengths;
      if (state.playing) play();
    });
    $('edLengths').addEventListener('change', function () {
      state.song.lengths = $('edLengths').value;
      if (state.playing) play();
    });
    $('edTempo').addEventListener('input', function () { state.song.tempo = +$('edTempo').value || 104; showArticNow(); });
    const map = { edTitle: 'title', edStyle: 'style', edRegion: 'region', edVideo: 'videoUrl' };
    Object.keys(map).forEach(function (id) {
      $(id).addEventListener('input', function () { state.song[map[id]] = $(id).value; });
    });
    $('edDiff').addEventListener('change', function () { state.song.difficulty = $('edDiff').value; });
  }

  // ---- paleta akordov podľa tóniny ----
  function buildPalette() {
    const host = $('palette');
    host.innerHTML = '';
    const key = Theory.getKey(state.song.key);
    const fns = Theory.functionsFor(key);
    const items = [ { ch: fns.T, tsd: true }, { ch: fns.S, tsd: true }, { ch: fns.D, tsd: true } ];
    Theory.extraChords(key).forEach(function (ch) { items.push({ ch: ch, tsd: false }); });
    const seen = {};
    items.forEach(function (it) {
      const tok = tokenOf(it.ch);
      if (seen[tok]) return; seen[tok] = true;
      const b = el('button', 'chip-chord' + (it.tsd ? ' tsd' : ''), tok);
      b.type = 'button';
      // nestrácať kurzor z políčka pri kliknutí na paletu
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () { fromPalette(tok); });
      host.appendChild(b);
    });
  }

  // Paleta vpíše akord do políčka s kurzorom (inak do prvého voľného) a skočí ďalej.
  function fromPalette(tok) {
    let f = state.focus;
    if (!f) f = firstEmpty() || { t: state.song.bars.length - 1, s: slots() - 1 };
    state.song.bars[f.t].chords[f.s] = tok;
    const inp = slotInput(f.t, f.s);
    if (inp) { inp.value = tok; inp.classList.remove('bad'); }
    renderPreview();
    focusSlot(nextSlot(f));
  }
  function firstEmpty() {
    const bars = state.song.bars;
    for (let t = 0; t < bars.length; t++) {
      for (let s = 0; s < bars[t].chords.length; s++) if (!bars[t].chords[s]) return { t: t, s: s };
    }
    return null;
  }
  function nextSlot(f) {
    if (f.s + 1 < slots()) return { t: f.t, s: f.s + 1 };
    if (f.t + 1 < state.song.bars.length) return { t: f.t + 1, s: 0 };
    return f; // posledné políčko — ostaň
  }
  function prevSlot(f) {
    if (f.s > 0) return { t: f.t, s: f.s - 1 };
    if (f.t > 0) return { t: f.t - 1, s: slots() - 1 };
    return f;
  }
  function slotInput(t, s) { return document.querySelector('.slot[data-t="' + t + '"][data-s="' + s + '"]'); }
  function focusSlot(f) {
    state.focus = f;
    const inp = slotInput(f.t, f.s);
    if (inp) { inp.focus(); inp.select(); }
  }

  // ---- takty ----
  function addTakt() {
    state.song.bars.push({ chords: new Array(slots()).fill('') });
    state.rangeEnd = null;
    renderBars(); renderPreview();
    focusSlot({ t: state.song.bars.length - 1, s: 0 });
  }
  function deleteTakt(t) {
    if (state.song.bars.length === 1) {
      state.song.bars[0].chords = new Array(slots()).fill('');
    } else {
      state.song.bars.splice(t, 1);
    }
    state.active = Math.min(state.active, state.song.bars.length - 1);
    state.rangeEnd = null;
    state.focus = null;
    renderBars(); renderPreview(); updatePlayLabel();
  }

  // Úsek na prehrávanie: klik na číslo/okraj taktu = začiatok, Shift+klik / podržanie = koniec.
  function setActive(i) { state.active = i; state.rangeEnd = null; paintRange(); }
  function extendTo(j) { state.rangeEnd = j; paintRange(); }
  function rangeBounds() {
    const a = state.active;
    if (state.rangeEnd === null) return { from: a, to: state.song.bars.length - 1, open: true };
    return { from: Math.min(a, state.rangeEnd), to: Math.max(a, state.rangeEnd), open: false };
  }
  // Prefarbí takty bez prekreslenia (aby sa nestratil kurzor v políčku).
  function paintRange() {
    const r = rangeBounds();
    document.querySelectorAll('#bars .measure').forEach(function (m, ti) {
      m.classList.toggle('is-start', ti === state.active);
      m.classList.toggle('in-range', !r.open && ti >= r.from && ti <= r.to);
      m.classList.toggle('is-dim', ti < r.from || ti > r.to);
      m.querySelector('.mnum span').textContent = (ti === state.active ? '▸ ' : '') + (ti + 1);
    });
    updatePlayLabel();
  }

  function renderBars() {
    const host = $('bars');
    host.innerHTML = '';
    host.style.setProperty('--slots', slots());
    state.song.bars.forEach(function (tak, ti) {
      const m = el('div', 'measure');

      const head = el('div', 'mnum');
      head.appendChild(el('span', null, String(ti + 1)));
      const del = el('button', 'mdel', '×');
      del.type = 'button';
      del.title = 'Zmazať takt ' + (ti + 1);
      del.setAttribute('aria-label', 'Zmazať takt ' + (ti + 1));
      del.addEventListener('click', function (e) { e.stopPropagation(); deleteTakt(ti); });
      head.appendChild(del);
      m.appendChild(head);

      const cells = el('div', 'cells');
      tak.chords.forEach(function (c, si) {
        const inp = el('input', 'slot');
        inp.type = 'text';
        inp.value = c || '';
        inp.maxLength = 6;
        inp.spellcheck = false;
        inp.autocomplete = 'off';
        inp.dataset.t = ti; inp.dataset.s = si;
        inp.setAttribute('aria-label', 'Takt ' + (ti + 1) + ', doba ' + (si + 1));
        if (c && !Theory.parseChord(c)) inp.classList.add('bad');
        const remember = function () { state.focus = { t: ti, s: si }; };
        inp.addEventListener('focus', remember);
        inp.addEventListener('pointerdown', remember);
        inp.addEventListener('input', function () {
          const v = inp.value.trim();
          state.song.bars[ti].chords[si] = v;
          inp.classList.toggle('bad', !!v && !Theory.parseChord(v));
          renderPreview();
        });
        inp.addEventListener('keydown', function (e) {
          const f = { t: ti, s: si };
          if (e.key === 'Enter') { e.preventDefault(); focusSlot(nextSlot(f)); }
          else if (e.key === 'Backspace' && !inp.value) { e.preventDefault(); focusSlot(prevSlot(f)); }
          else if (e.key === 'ArrowRight' && inp.selectionStart === inp.value.length) { e.preventDefault(); focusSlot(nextSlot(f)); }
          else if (e.key === 'ArrowLeft' && inp.selectionStart === 0) { e.preventDefault(); focusSlot(prevSlot(f)); }
        });
        cells.appendChild(inp);
      });
      m.appendChild(cells);

      // Výber úseku — klik mimo políčok (číslo taktu, okraj).
      let pressTimer = null, longPressed = false;
      m.addEventListener('pointerdown', function (e) {
        if (e.target.closest('.slot, .mdel')) return;
        longPressed = false;
        pressTimer = setTimeout(function () { longPressed = true; extendTo(ti); }, 450);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
        m.addEventListener(ev, function () { clearTimeout(pressTimer); });
      });
      m.addEventListener('click', function (e) {
        if (e.target.closest('.slot, .mdel')) return;
        if (longPressed) { longPressed = false; return; }
        if (e.shiftKey) extendTo(ti); else setActive(ti);
      });

      host.appendChild(m);
    });
    const add = el('button', 'add-takt');
    add.type = 'button'; add.title = 'Pridať takt'; add.innerHTML = ICON_PLUS;
    add.addEventListener('click', addTakt);
    host.appendChild(add);

    const n = state.song.bars.length;
    $('timeLabel').textContent = (state.song.timeSig || '2/4') + ' · ' + n + (n === 1 ? ' takt' : (n < 5 ? ' takty' : ' taktov'));
    paintRange();
  }

  function updatePlayLabel() {
    const r = rangeBounds();
    let t;
    if (r.open) t = r.from === 0 ? 'Prehrať' : ('Prehrať od ' + (r.from + 1) + '. taktu');
    else if (r.from === r.to) t = 'Prehrať ' + (r.from + 1) + '. takt';
    else t = 'Prehrať takty ' + (r.from + 1) + '–' + (r.to + 1);
    $('playLabel').textContent = t;
  }

  // ---- náhľad bas/kontra ----
  function renderPreview() {
    const host = $('preview');
    host.innerHTML = '';
    const parsed = Store.flatChords(state.song).map(function (t) { return Theory.parseChord(t); }).filter(Boolean);
    if (!parsed.length) {
      host.appendChild(el('p', 'hint', 'Zatiaľ žiadne akordy — napíš ich do políčok alebo vyber z palety.'));
      return;
    }
    const bassLine = window.Bass ? Bass.computeLine(parsed) : [];
    const kontraLine = window.Kontra ? Kontra.computeLine(parsed, 'viola') : [];
    parsed.forEach(function (ch, i) {
      const col = el('div', 'prev-col');
      col.appendChild(el('div', 'ch', ch.token));
      const bn = bassLine[i] && bassLine[i].bass[0] ? bassLine[i].bass[0].note : '–';
      col.appendChild(el('div', 'bas', 'bas ' + bn));
      const kn = kontraLine[i] ? kontraLine[i].dvojhmat.map(function (n) { return n.note; }).join('–') : '–';
      col.appendChild(el('div', 'kon', 'kontra ' + kn));
      host.appendChild(col);
    });
  }

  // ---- prehrávanie ----
  // Zvýrazní práve hrané políčko (i = poradie doby v prehrávanom úseku, -1 = koniec).
  function markPlaying(i, from) {
    document.querySelectorAll('.slot.playing').forEach(function (x) { x.classList.remove('playing'); });
    if (i < 0) { state.playing = false; return; }
    const n = slots();
    const inp = slotInput(from + Math.floor(i / n), i % n);
    if (inp) inp.classList.add('playing');
  }
  function play() {
    const r = rangeBounds();
    const slotsList = Store.slotChords(state.song, r.from, r.to)
      .map(function (t) { return t ? Theory.parseChord(t) : null; });
    if (!slotsList.some(Boolean) || !window.Sound) return;
    state.playing = true;
    Sound.playSlots(slotsList, {
      bpm: state.song.tempo || 104,
      meter: state.song.timeSig || '2/4',
      style: state.song.accomp,
      artic: state.song.artic,
      accent: state.song.accent,
      lengths: Store.lengthsOf(state.song),
      mode: 'band',
      loop: state.loop,
      onStep: function (i) { markPlaying(i, r.from); }
    });
  }
  function stop() { if (window.Sound) Sound.stop(); markPlaying(-1, 0); }

  // ---- uloženie ----
  function save() {
    const s = state.song;
    s.title = $('edTitle').value.trim() || 'Bez názvu';
    s.key = $('edKey').value;
    s.timeSig = $('edTime').value;
    s.accomp = $('edAccomp').value;
    s.artic = $('edArtic').value;
    s.accent = $('accentField').hidden ? '' : $('edAccent').value;
    s.lengths = $('lengthsField').hidden ? '' : $('edLengths').value;
    s.tempo = +$('edTempo').value || 104;
    s.style = $('edStyle').value.trim();
    s.region = $('edRegion').value.trim();
    s.difficulty = $('edDiff').value;
    s.videoUrl = $('edVideo').value.trim();
    const saved = Store.save(s);
    location.href = 'piesen.html?id=' + encodeURIComponent(saved.id);
  }

  // ---- init ----
  fillKeys();
  loadFields();
  bindFields();
  buildPalette();
  renderBars();
  renderPreview();

  $('play').addEventListener('click', play);
  $('stop').addEventListener('click', stop);
  $('loop').addEventListener('click', function () {
    state.loop = !state.loop;
    $('loop').classList.toggle('on', state.loop);
    $('loop').setAttribute('aria-pressed', state.loop ? 'true' : 'false');
    if (state.playing) play(); // zmena počas hrania — spusti úsek znova s novým nastavením
  });
  $('save').addEventListener('click', save);
})();

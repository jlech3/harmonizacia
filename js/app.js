// app.js — prepojenie UI: výber tóniny, akordy (T/S/D + ďalšie diatonické),
// detail akordu podľa role stránky:
//   basista = jeden basový tón (základný) na kontrabase vo všetkých polohách,
//   kontráš = hmaty akordu na husliach a viole.
// Rolu určuje atribút data-role na <body> ('basista' | 'kontras').
// Menu stránka rolu nemá — skript sa hneď ukončí.
(function () {
  'use strict';

  const role = document.body.getAttribute('data-role');
  if (!role) return; // hlavné menu — žiadna logika

  const isBass = role === 'basista';

  const keySelect = document.getElementById('keySelect');
  const functionsEl = document.getElementById('functions');
  const scaleEl = document.getElementById('scale');
  const detailEl = document.getElementById('detail');

  // selKind: 'fn' = T/S/D, 'extra' = ďalší diatonický akord (stupeň 2/3/6/7).
  const state = { keyId: Theory.KEYS[0].id, selKind: 'fn', fn: 'T', extraIndex: 0 };

  function elc(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function colorFor(r) {
    return Fingerboard.ROLE_COLORS[r] || '#666';
  }

  function toName(n) { return n.name; }

  function init() {
    Theory.KEYS.forEach(function (k) {
      const o = document.createElement('option');
      o.value = k.id;
      o.textContent = k.display;
      keySelect.appendChild(o);
    });
    keySelect.value = state.keyId;
    keySelect.addEventListener('change', function () {
      state.keyId = keySelect.value;
      render();
    });
    render();
    setupTrainer();      // kontráš (no-op, ak prvky nie sú na stránke)
    setupBassTrainer();  // basista (no-op, ak prvky nie sú na stránke)
  }

  function currentChord(fns, extras) {
    return state.selKind === 'extra' ? extras[state.extraIndex] : fns[state.fn];
  }

  function render() {
    const key = Theory.getKey(state.keyId);
    const fns = Theory.functionsFor(key);
    const extras = Theory.extraChords(key);
    renderFunctions(fns);
    renderExtraChords(extras);
    const chord = currentChord(fns, extras);
    if (isBass) renderBassChordDetail(key, chord);
    else renderKontraChordDetail(key, chord);
  }

  // Tri hlavné funkcie T/S/D ako veľké karty.
  function renderFunctions(fns) {
    functionsEl.innerHTML = '';
    ['T', 'S', 'D'].forEach(function (fk) {
      const ch = fns[fk];
      const active = state.selKind === 'fn' && state.fn === fk;
      const card = elc('div', 'fn-card' + (active ? ' active' : ''));
      card.appendChild(elc('div', 'abbr', ch.abbr));
      card.appendChild(elc('div', 'fn-name', ch.fnName));
      card.appendChild(elc('div', 'chord-name', ch.name));
      card.addEventListener('click', function () {
        state.selKind = 'fn';
        state.fn = fk;
        render();
      });
      functionsEl.appendChild(card);
    });
  }

  // Ďalšie diatonické akordy (stupne 2/3/6/7) ako menšie karty.
  function renderExtraChords(extras) {
    scaleEl.innerHTML = '';
    scaleEl.appendChild(elc('h3', 'scale-title', 'Ďalšie akordy v tónine'));
    scaleEl.appendChild(elc('p', 'scale-hint', 'Okrem T/S/D môžeš harmonizovať aj týmito akordmi. Klikni a pozri si hmaty.'));
    const grid = elc('div', 'scale-tones');
    extras.forEach(function (ch, i) {
      const active = state.selKind === 'extra' && state.extraIndex === i;
      const card = elc('div', 'tone-card' + (active ? ' active' : ''));
      card.appendChild(elc('div', 'deg', ch.degree + '. stupeň'));
      card.appendChild(elc('div', 'tone-name', ch.name));
      card.addEventListener('click', function () {
        state.selKind = 'extra';
        state.extraIndex = i;
        render();
      });
      grid.appendChild(card);
    });
    scaleEl.appendChild(grid);
  }

  // Spoločná hlavička detailu: názov, popis, tlačidlo prehrania.
  function detailHeader(key, chord, playHandler, playLabel) {
    detailEl.hidden = false;
    detailEl.innerHTML = '';
    detailEl.appendChild(elc('h2', null, chord.name));
    detailEl.appendChild(elc('p', 'sub', chord.fnName + ' v tónine ' + key.display));
    const btn = elc('button', 'play-btn', playLabel);
    btn.type = 'button';
    btn.addEventListener('click', playHandler);
    detailEl.appendChild(btn);
  }

  // Blok „Zloženie akordu".
  function composition(chord) {
    const comp = elc('div', 'block');
    comp.appendChild(elc('h3', null, 'Zloženie akordu'));
    const ul = elc('ul', 'notes');
    chord.notes.forEach(function (nt) {
      const li = document.createElement('li');
      const dot = elc('span', 'dot');
      dot.style.background = colorFor(nt.role);
      li.appendChild(dot);
      const txt = document.createElement('div');
      txt.appendChild(elc('div', 'note-name', nt.name));
      txt.appendChild(elc('div', 'note-role', nt.role));
      li.appendChild(txt);
      ul.appendChild(li);
    });
    comp.appendChild(ul);
    if (chord.hasSeventh) {
      comp.appendChild(elc('p', 'opt', 'Septima sa k dominante v ľudovkách často pridáva (D7), ale dá sa aj vynechať.'));
    }
    return comp;
  }

  // KONTRÁŠ: zloženie + hlasy + hmaty akordu na husliach a viole.
  function renderKontraChordDetail(key, chord) {
    detailHeader(key, chord, function () {
      Sound.playChord(chord.notes.map(function (n) { return n.pc; }), { octave: 3, voice: 'kontra', duration: 1.4 });
    }, '▶ Prehrať akord');

    detailEl.appendChild(composition(chord));

    // Hlasy: bas vs kontra (informačné)
    const voices = elc('div', 'block');
    voices.appendChild(elc('h3', null, 'Hlasy v muzike'));
    const grid = elc('div', 'voices');

    const bas = elc('div', 'voice clickable');
    bas.title = 'Klikni a vypočuj basový hlas';
    bas.addEventListener('click', function () {
      Sound.playChord(chord.bass.map(function (n) { return n.pc; }), { octave: 2, voice: 'bass', duration: 1.2 });
    });
    bas.appendChild(elc('h4', null, 'Bas — kontrabas'));
    bas.appendChild(elc('div', 'tones', chord.bass.map(toName).join('  –  ')));
    bas.appendChild(elc('div', 'desc', 'Hrá základný tón, ktorý sa typicky strieda s kvintou (na ťažkú dobu).'));
    grid.appendChild(bas);

    const kontra = elc('div', 'voice clickable');
    kontra.title = 'Klikni a vypočuj kontra hlas';
    kontra.addEventListener('click', function () {
      Sound.playChord(chord.kontra.map(function (n) { return n.pc; }), { octave: 3, voice: 'kontra', duration: 1.2 });
    });
    kontra.appendChild(elc('h4', null, 'Kontra — viola'));
    kontra.appendChild(elc('div', 'tones', chord.kontra.map(toName).join('  –  ')));
    kontra.appendChild(elc('div', 'desc', 'Akordické tóny — krátke akordy na ľahkú dobu, vypĺňajú harmóniu.'));
    grid.appendChild(kontra);

    voices.appendChild(grid);
    detailEl.appendChild(voices);

    // Hmaty husle + viola
    const boards = elc('div', 'block');
    boards.appendChild(elc('h3', null, 'Hmaty v 1. polohe'));
    boards.appendChild(legend(chord.notes));
    if (chord.hasSeventh) {
      boards.appendChild(elc('p', 'seventh-note', 'Septima je zvýraznená dvojitým krúžkom — v septakorde ju do harmónie prináša kontra.'));
    }
    const bgrid = elc('div', 'boards');
    ['husle', 'viola'].forEach(function (instId) {
      const wrap = elc('div', 'board');
      wrap.appendChild(elc('h4', null, Instruments.INSTRUMENTS[instId].name));
      const placements = Instruments.placementsForChord(instId, chord.notes);
      wrap.appendChild(Fingerboard.render(instId, placements));
      bgrid.appendChild(wrap);
    });
    boards.appendChild(bgrid);
    detailEl.appendChild(boards);
  }

  // BASISTA: bas hrá jeden tón na akord (základný tón) — zobrazený na kontrabase
  // vo všetkých miestach 1. polohy, kde sa dá chytiť.
  function renderBassChordDetail(key, chord) {
    const root = chord.notes[0]; // Základný tón
    detailHeader(key, chord, function () {
      Sound.playNote(root.pc, { octave: 2, voice: 'bass', duration: 1.4 });
    }, '▶ Prehrať basový tón');

    detailEl.appendChild(composition(chord));

    const boards = elc('div', 'block');
    boards.appendChild(elc('h3', null, 'Bas na kontrabase — 1. poloha'));
    boards.appendChild(elc('p', 'opt', 'Bas hrá jeden tón na akord — základný tón „' + root.name + '". Tu sú všetky miesta v 1. polohe, kde ho chytíš.'));
    const bgrid = elc('div', 'boards boards-one');
    const wrap = elc('div', 'board');
    wrap.appendChild(elc('h4', null, Instruments.INSTRUMENTS['kontrabas'].name));
    const placements = Instruments.placementsForChord('kontrabas', [root]);
    wrap.appendChild(Fingerboard.render('kontrabas', placements));
    bgrid.appendChild(wrap);
    boards.appendChild(bgrid);
    detailEl.appendChild(boards);
  }

  function legend(notes) {
    const wrap = elc('div', 'legend');
    notes.forEach(function (nt) {
      const s = document.createElement('span');
      const d = elc('span', 'dot');
      d.style.background = colorFor(nt.role);
      let label = nt.role + ' (' + nt.name + ')';
      if (nt.role === 'Septima') {
        d.style.boxShadow = '0 0 0 2px #fcfbf8, 0 0 0 4px ' + colorFor(nt.role);
        label += ' — hrá ju kontra';
      }
      s.appendChild(d);
      s.appendChild(document.createTextNode(label));
      wrap.appendChild(s);
    });
    return wrap;
  }

  // ---- Tréner kontra linky ----

  const QUALITY_TEXT = { dur: 'dur', mol: 'mol', dim: 'zmenšený' };
  function chordFullName(chord) {
    const base = chord.root.name + ' ' + (QUALITY_TEXT[chord.quality] || chord.quality);
    return chord.has7 ? base + ' 7' : base;
  }

  function fingerLabel(nt) {
    return nt.finger === 0 ? 'prázdna struna' : nt.finger + '. prst';
  }

  function playDvojhmat(notes) {
    Sound.playChord(notes.map(function (n) { return n.pc; }), { octave: 3, voice: 'kontra', duration: 1.1 });
  }

  // Zoznam tónov dvojhmatu (rola, prst, prípadne držaný tón).
  function dsList(notes) {
    const ds = elc('div', 'prog-ds');
    notes.forEach(function (nt) {
      const item = elc('div', 'prog-ds-item' + (nt.held ? ' held' : ''));
      const dot = elc('span', 'dot');
      dot.style.background = colorFor(nt.role);
      item.appendChild(dot);
      let label = nt.note + ' · ' + nt.role + ' · ' + fingerLabel(nt);
      if (nt.held) label += ' · drží sa';
      item.appendChild(document.createTextNode(label));
      ds.appendChild(item);
    });
    return ds;
  }

  // Tlačidlo na prehranie dvojhmatu (zastaví bublanie, aby nespustilo iné akcie).
  function playButton(notes, label, extraClass) {
    const b = elc('button', 'play-btn small' + (extraClass ? ' ' + extraClass : ''), label);
    b.type = 'button';
    b.addEventListener('click', function (e) { e.stopPropagation(); playDvojhmat(notes); });
    return b;
  }

  // Do kontajnera vykreslí JEDEN hmatník so všetkými tónmi akordu v 1. polohe
  // (všetky guličky — rovnako ako na podstránke „Hmaty akordov"). Hráč si z nich
  // sám poskladá dvojhmat: ľubovoľné dve susedné struny.
  function buildAlts(container, chord, instId) {
    container.appendChild(elc('p', 'prog-alts-hint',
      'Všetky tóny akordu v 1. polohe. Dvojhmat = ľubovoľné dve susedné struny.'));
    container.appendChild(legend(chord.notes));
    if (chord.has7) {
      container.appendChild(elc('p', 'seventh-note',
        'Septima je zvýraznená dvojitým krúžkom — v septakorde ju do harmónie prináša kontra.'));
    }
    const placements = Instruments.placementsForChord(instId, chord.notes);
    container.appendChild(Fingerboard.render(instId, placements));
    const actions = elc('div', 'prog-actions');
    actions.appendChild(playButton(chord.notes, '▶ Prehrať akord'));
    container.appendChild(actions);
  }

  function trainerCell(step, instId) {
    const chord = step.chord;
    const cell = elc('div', 'prog-cell');
    cell.appendChild(elc('div', 'prog-chord', chord.token));
    cell.appendChild(elc('div', 'prog-sub', chordFullName(chord)));
    cell.appendChild(Fingerboard.render(instId, step.dvojhmat));
    cell.appendChild(dsList(step.dvojhmat));

    // Akcie: prehrať dvojhmat + rozbaliť ďalšie hmaty.
    const actions = elc('div', 'prog-actions');
    actions.appendChild(playButton(step.dvojhmat, '▶ Prehrať'));

    const moreBtn = elc('button', 'play-btn ghost small', 'Viac hmatov ▾');
    moreBtn.type = 'button';
    moreBtn.setAttribute('aria-expanded', 'false');
    const alts = elc('div', 'prog-alts');
    alts.hidden = true;
    let built = false;
    moreBtn.addEventListener('click', function () {
      if (!built) { buildAlts(alts, chord, instId); built = true; }
      alts.hidden = !alts.hidden;
      moreBtn.textContent = alts.hidden ? 'Viac hmatov ▾' : 'Menej hmatov ▴';
      moreBtn.setAttribute('aria-expanded', alts.hidden ? 'false' : 'true');
    });
    actions.appendChild(moreBtn);

    cell.appendChild(actions);
    cell.appendChild(alts);
    return cell;
  }

  // Zapojí ovládanie prehrávania (Prehrať / Stop / tempo) pre daný tréner.
  // mode: 'band' (bas + kontra, umca-umca) alebo 'bass' (len basa, držaný tón cez takt).
  function setupPlayback(input, playId, stopId, tempoId, tempoValId, mode) {
    const playBtn = document.getElementById(playId);
    const stopBtn = document.getElementById(stopId);
    const tempo = document.getElementById(tempoId);
    const tempoVal = document.getElementById(tempoValId);
    if (tempo && tempoVal) {
      tempo.addEventListener('input', function () { tempoVal.textContent = tempo.value; });
    }
    if (playBtn) {
      playBtn.addEventListener('click', function () {
        const parsed = Theory.parseProgression(input.value);
        if (parsed.chords.length) {
          Sound.playProgression(parsed.chords, { bpm: tempo ? +tempo.value : 104, mode: mode });
        }
      });
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', function () { Sound.stop(); });
    }
  }

  function setupTrainer() {
    const input = document.getElementById('progInput');
    const errEl = document.getElementById('progErrors');
    const resEl = document.getElementById('progResult');
    if (!input) return;

    const instSel = document.getElementById('kontraInstrument');
    setupPlayback(input, 'progPlay', 'progStop', 'progTempo', 'progTempoVal', 'band');

    function update() {
      const instId = instSel ? instSel.value : 'viola';
      const parsed = Theory.parseProgression(input.value);
      errEl.innerHTML = '';
      resEl.innerHTML = '';

      parsed.errors.forEach(function (tok) {
        errEl.appendChild(elc('div', 'prog-error', 'Neznámy akord: „' + tok + '“'));
      });

      if (!parsed.chords.length) return;

      const line = Kontra.computeLine(parsed.chords, instId);
      const row = elc('div', 'prog-row');
      line.forEach(function (step) { row.appendChild(trainerCell(step, instId)); });
      resEl.appendChild(row);
    }

    input.addEventListener('input', update);
    if (instSel) instSel.addEventListener('change', update);
    update();
  }

  // ---- Tréner prstokladu kontrabasu ----

  function bassPosLabel(handLoc) {
    return handLoc === 0 ? 'prázdna struna' : 'poloha: 1. prst na ' + handLoc + '. poltóne';
  }

  function roleOrder(role) { return role === 'Základný tón' ? 0 : 1; }

  function bassCell(step) {
    const chord = step.chord;
    const cell = elc('div', 'prog-cell');
    cell.appendChild(elc('div', 'prog-chord', chord.token));
    cell.appendChild(elc('div', 'prog-sub', chordFullName(chord)));
    cell.appendChild(Fingerboard.render('kontrabas', step.bass));
    cell.appendChild(elc('div', 'prog-pos', bassPosLabel(step.handLoc)));
    cell.classList.add('clickable');
    cell.title = 'Klikni a vypočuj basový tón';
    cell.addEventListener('click', function () {
      Sound.playNote(step.bass[0].pc, { octave: 2, voice: 'bass', duration: 1.4 });
    });

    const ds = elc('div', 'prog-ds');
    step.bass.slice().sort(function (a, b) { return roleOrder(a.role) - roleOrder(b.role); })
      .forEach(function (nt) {
        const item = elc('div', 'prog-ds-item' + (nt.held ? ' held' : ''));
        const dot = elc('span', 'dot');
        dot.style.background = colorFor(nt.role);
        item.appendChild(dot);
        const finger = nt.finger === 0 ? 'prázdna struna' : nt.finger + '. prst';
        let label = nt.note + ' · ' + nt.role + ' · ' + finger + ' (struna ' + nt.stringName + ')';
        if (nt.held) label += ' · drží sa';
        item.appendChild(document.createTextNode(label));
        ds.appendChild(item);
      });
    cell.appendChild(ds);
    return cell;
  }

  function setupBassTrainer() {
    const input = document.getElementById('bassInput');
    const errEl = document.getElementById('bassErrors');
    const resEl = document.getElementById('bassResult');
    if (!input) return;

    setupPlayback(input, 'bassPlay', 'bassStop', 'bassTempo', 'bassTempoVal', 'bass');

    function update() {
      const parsed = Theory.parseProgression(input.value);
      errEl.innerHTML = '';
      resEl.innerHTML = '';

      parsed.errors.forEach(function (tok) {
        errEl.appendChild(elc('div', 'prog-error', 'Neznámy akord: „' + tok + '“'));
      });

      if (!parsed.chords.length) return;

      const line = Bass.computeLine(parsed.chords);
      const row = elc('div', 'prog-row');
      line.forEach(function (step) { row.appendChild(bassCell(step)); });
      resEl.appendChild(row);
    }

    input.addEventListener('input', update);
    update();
  }

  // ---- Podstránka „Hmaty akordov" (ľubovoľný akord, mimo tóniny) ----

  // 12 základných tónov; pri krížikoch/béčkach ukážeme aj enharmonický názov.
  const PICK_ROOTS = [
    { pc: 0 }, { pc: 1, alt: 'Des' }, { pc: 2 }, { pc: 3, alt: 'Dis' },
    { pc: 4 }, { pc: 5 }, { pc: 6, alt: 'Ges' }, { pc: 7 },
    { pc: 8, alt: 'Gis' }, { pc: 9 }, { pc: 10, alt: 'Ais' }, { pc: 11 }
  ];
  const PICK_QUALITIES = [
    { id: 'dur', label: 'dur' },
    { id: 'mol', label: 'mol' },
    { id: 'dur7', label: 'septakord', sub: 'dur 7' },
    { id: 'dim', label: 'zmenšený' }
  ];
  const QUALITY_SUB = {
    dur: 'durový akord', mol: 'molový akord', dur7: 'dominantný septakord', dim: 'zmenšený akord'
  };

  const pickState = { rootPc: 0, quality: 'dur' };

  function initChordLookup() {
    renderPicker();
    renderPickDetail();
  }

  // Jedna prepínacia skupina tlačidiel (základný tón / druh akordu).
  function pickerGroup(labelText, items, isActive, onPick) {
    const group = elc('div', 'picker-group');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', labelText);
    group.appendChild(elc('h2', 'picker-label', labelText));
    const row = elc('div', 'picker-row');
    items.forEach(function (it) {
      const btn = elc('button', 'picker-btn' + (isActive(it) ? ' active' : ''));
      btn.type = 'button';
      btn.setAttribute('aria-pressed', isActive(it) ? 'true' : 'false');
      btn.setAttribute('aria-label', it.ariaLabel);
      btn.appendChild(elc('span', 'picker-main', it.main));
      if (it.alt) btn.appendChild(elc('span', 'picker-alt', it.alt));
      btn.addEventListener('click', function () { onPick(it); });
      row.appendChild(btn);
    });
    group.appendChild(row);
    return group;
  }

  function renderPicker() {
    const pick = document.getElementById('chordPicker');
    pick.innerHTML = '';

    const roots = PICK_ROOTS.map(function (r) {
      const name = Theory.pcName(r.pc);
      return {
        pc: r.pc, main: name, alt: r.alt,
        ariaLabel: 'Základný tón ' + name + (r.alt ? ' alebo ' + r.alt : '')
      };
    });
    pick.appendChild(pickerGroup('Základný tón', roots,
      function (it) { return pickState.rootPc === it.pc; },
      function (it) { pickState.rootPc = it.pc; renderPicker(); renderPickDetail(); }));

    const quals = PICK_QUALITIES.map(function (q) {
      return {
        id: q.id, main: q.label, alt: q.sub,
        ariaLabel: q.label + (q.sub ? ' (' + q.sub + ')' : '')
      };
    });
    pick.appendChild(pickerGroup('Druh akordu', quals,
      function (it) { return pickState.quality === it.id; },
      function (it) { pickState.quality = it.id; renderPicker(); renderPickDetail(); }));
  }

  function renderPickDetail() {
    const chord = Theory.chordFromPc(pickState.rootPc, pickState.quality);

    detailEl.hidden = false;
    detailEl.innerHTML = '';
    detailEl.appendChild(elc('h2', null, chord.name));
    detailEl.appendChild(elc('p', 'sub', QUALITY_SUB[pickState.quality] || ''));
    const play = elc('button', 'play-btn', '▶ Prehrať akord');
    play.type = 'button';
    play.addEventListener('click', function () {
      Sound.playChord(chord.notes.map(function (n) { return n.pc; }), { octave: 3, voice: 'kontra', duration: 1.4 });
    });
    detailEl.appendChild(play);

    detailEl.appendChild(composition(chord));

    const boards = elc('div', 'block');
    boards.appendChild(elc('h3', null, 'Hmaty na husliach a viole'));
    boards.appendChild(legend(chord.notes));
    if (chord.hasSeventh) {
      boards.appendChild(elc('p', 'seventh-note', 'Septima je zvýraznená dvojitým krúžkom — v septakorde ju do harmónie prináša kontra.'));
    }
    const bgrid = elc('div', 'boards');
    ['husle', 'viola'].forEach(function (instId) {
      const wrap = elc('div', 'board');
      wrap.appendChild(elc('h4', null, Instruments.INSTRUMENTS[instId].name));
      const placements = Instruments.placementsForChord(instId, chord.notes);
      wrap.appendChild(Fingerboard.render(instId, placements));
      bgrid.appendChild(wrap);
    });
    boards.appendChild(bgrid);
    detailEl.appendChild(boards);
  }

  if (role === 'akordy') initChordLookup();
  else init();
})();

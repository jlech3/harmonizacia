// bass.js — tréner prstokladu pre kontrabas (ľudová hra).
// V ľudovej hudbe bas hrá JEDEN tón na akord:
//   • bežný akord (dur/mol) → základný tón,
//   • septakord (X7)        → tercia akordu = citlivý tón, ktorý vedie
//                              do základného tónu nasledujúceho akordu
//                              (napr. D7 → Fis, 4. prst na D strune).
// Polohy volíme tak, aby ruka po krku zbytočne nebehala (DP, minimálny posun).
// V nízkych polohách kontrabas používa prsty 1 – 2 – 4 (Simandl); ruka pokrýva
// celý tón: 1. prst → +0, 2. prst → +1, 4. prst → +2 poltóna.
(function (global) {
  'use strict';

  const BASS = 'kontrabas';
  const MAX_SEMI = 7; // držíme sa nízkych polôh (ľudová hra)
  const HOME = 2;     // domáca poloha ruky (1. prst zhruba na 2. poltóne)

  // Prst podľa vzdialenosti tónu od polohy ruky (rel = poltón − handLoc).
  function fingerFor(rel) {
    if (rel === 0) return 1;
    if (rel === 1) return 2;
    if (rel === 2) return 4;
    return null;
  }

  // Tón, ktorý bas pre daný akord hrá: bežne základný tón, pri 7 terciu.
  function bassNote(chord) {
    // Zmenšený akord: bas hrá zmenšenú kvintu (citlivý tón, vedie o pol tóna nahor).
    // Pomenujeme ju jednoducho (Cis, As…), tak ako to basista číta — nie ako Des.
    if (chord.quality === 'dim') {
      return { name: global.Theory.pcName(chord.fifth.pc), pc: chord.fifth.pc, role: 'Zmenšená kvinta' };
    }
    const src = chord.has7 ? chord.third : chord.root;
    return {
      name: src.name,
      pc: src.pc,
      role: chord.has7 ? 'Tercia' : 'Základný tón'
    };
  }

  function make(si, sName, semis, finger, isOpen, handLoc, note) {
    return {
      stringIndex: si, stringName: sName, semis: semis,
      finger: finger, isOpen: isOpen, handLoc: handLoc,
      note: note.name, pc: note.pc, role: note.role
    };
  }

  // Všetky hrateľné polohy basového tónu na kontrabase (v nízkych polohách).
  function candidates(chord) {
    const strings = global.Instruments.INSTRUMENTS[BASS].strings;
    const note = bassNote(chord);
    const out = [];

    strings.forEach(function (str, si) {
      const d = ((note.pc - str.pc) % 12 + 12) % 12;
      if (d > MAX_SEMI) return;

      if (d === 0) {
        out.push(make(si, str.name, 0, 0, true, null, note)); // prázdna struna
        return;
      }
      // Fretovaný tón: ruka môže sedieť tak, že ho vezme 1., 2. alebo 4. prst.
      for (let h = d; h >= d - 2 && h >= 1; h--) {
        const f = fingerFor(d - h);
        if (f !== null) out.push(make(si, str.name, d, f, false, h, note));
      }
    });
    return out;
  }

  function staticCost(p) {
    if (p.isOpen) return 0;                          // prázdna struna je „zadarmo“
    return 0.5 + Math.abs(p.handLoc - HOME) * 0.5;   // inak uprednostni domácu polohu
  }

  // Cena prechodu medzi dvoma tónmi = posun ruky po krku + preskok strún.
  function transitionCost(a, b) {
    const stringDist = Math.abs(a.stringIndex - b.stringIndex) * 0.4;
    const handShift = (a.handLoc != null && b.handLoc != null)
      ? Math.abs(a.handLoc - b.handLoc)
      : 0; // prázdna struna nechá ruku voľne presunúť sa
    return stringDist + handShift;
  }

  // Pre postupnosť akordov vyberie basovú linku s minimálnym pohybom ruky (DP).
  function computeLine(chords) {
    const cands = chords.map(candidates);
    const n = cands.length;
    if (!n) return [];

    const dp = [], back = [];
    for (let i = 0; i < n; i++) { dp.push([]); back.push([]); }

    cands[0].forEach(function (c, j) { dp[0][j] = staticCost(c); back[0][j] = -1; });

    for (let i = 1; i < n; i++) {
      cands[i].forEach(function (c, j) {
        let best = Infinity, bi = -1;
        cands[i - 1].forEach(function (pc, k) {
          const cost = dp[i - 1][k] + transitionCost(pc, c) + staticCost(c);
          if (cost < best) { best = cost; bi = k; }
        });
        dp[i][j] = best;
        back[i][j] = bi;
      });
    }

    let best = Infinity, bj = 0;
    dp[n - 1].forEach(function (v, j) { if (v < best) { best = v; bj = j; } });

    const idx = new Array(n);
    let j = bj;
    for (let i = n - 1; i >= 0; i--) { idx[i] = j; j = back[i][j]; }
    const chosen = idx.map(function (id, i) { return cands[i][id]; });

    // Označ držaný tón: rovnaká struna aj poltón ako v predošlom akorde.
    chosen.forEach(function (p, i) {
      p.held = i > 0 &&
        chosen[i - 1].stringIndex === p.stringIndex &&
        chosen[i - 1].semis === p.semis;
    });

    return chosen.map(function (p, i) {
      return { chord: chords[i], bass: [p], handLoc: p.handLoc == null ? 0 : p.handLoc };
    });
  }

  global.Bass = {
    MAX_SEMI: MAX_SEMI,
    candidates: candidates,
    computeLine: computeLine
  };
})(window);

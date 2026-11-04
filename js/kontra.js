// kontra.js — výber dvojhmatov kontry (viola) a plynulé vedenie kontra linky.
// Kontra hrá dvojhmaty na dvoch susedných strunách. Tercia je povinná
// (určuje dur/mol). Pri septakorde kontra hrá terciu + septimu (tritonus).
(function (global) {
  'use strict';

  const DEFAULT_INST = 'viola';

  // Kontra hrá prioritne na spodných DVOCH strunách (index 0,1 = C–G pri viole,
  // G–D pri husliach); na vyššie struny ide, len keď sa akord dole hrať nedá.
  const STRING_PAIRS = [[0, 1]];
  // Záloha – IBA susedné struny. Dvojhmat sa dá sláčikom hrať len na dvoch
  // susedných strunách; nesusedný pár by preskočil strunu medzi nimi.
  const FALLBACK_PAIRS = [[1, 2], [2, 3]];

  // Dvojice rolí pre dvojhmat. Tercia je vždy prítomná.
  const PAIRS_TRIAD = [['Tercia', 'Kvinta'], ['Základný tón', 'Tercia']];
  const PAIRS_SEVENTH = [['Tercia', 'Septima']]; // tritonus dominanty

  const SHIFT_PENALTY = 4; // cena za zmenu páru strún (posun ruky)

  function noteByRole(chord, role) {
    return chord.notes.find(function (n) { return n.role === role; });
  }

  function decorate(placement, note) {
    return {
      stringIndex: placement.stringIndex,
      stringName: placement.stringName,
      semis: placement.semis,
      finger: placement.finger,
      isOpen: placement.isOpen,
      note: note.name,
      pc: note.pc,
      role: note.role
    };
  }

  // Nehrateľný dvojhmat: oba tóny fretované rovnakým prstom, ale v rôznych
  // polohách — jeden prst nevie byť na dvoch pražcoch naraz (rovnaký prst v
  // rovnakej polohe = barré, to je v poriadku; prázdna struna je vždy v poriadku).
  function playable(pLo, pHi) {
    if (pLo.isOpen || pHi.isOpen) return true;
    if (pLo.finger === pHi.finger && pLo.semis !== pHi.semis) return false;
    return true;
  }

  // Vygeneruje dvojhmaty pre dané dvojice rolí na zadaných pároch strún.
  // allowUnplayable=true vynechá kontrolu hrateľnosti (posledná záchrana).
  function buildCandidates(chord, rolePairs, stringPairs, instId, allowUnplayable) {
    const out = [];
    rolePairs.forEach(function (rp) {
      const nA = noteByRole(chord, rp[0]);
      const nB = noteByRole(chord, rp[1]);
      if (!nA || !nB) return;
      stringPairs.forEach(function (sp) {
        // Dve priradenia: ktorý tón ide na nižšiu strunu.
        [[nA, nB], [nB, nA]].forEach(function (asg) {
          const pLo = global.Instruments.placeOn(instId, sp[0], asg[0].pc);
          const pHi = global.Instruments.placeOn(instId, sp[1], asg[1].pc);
          if (!pLo || !pHi) return;
          if (!allowUnplayable && !playable(pLo, pHi)) return;
          out.push({ notes: [decorate(pLo, asg[0]), decorate(pHi, asg[1])] });
        });
      });
    });
    return dedup(out);
  }

  function dedup(cands) {
    const seen = {};
    const out = [];
    cands.forEach(function (c) {
      const s = byString(c);
      const key = s[0].stringIndex + ':' + s[0].semis + '|' + s[1].stringIndex + ':' + s[1].semis;
      if (!seen[key]) { seen[key] = true; out.push(c); }
    });
    return out;
  }

  // Všetky hrateľné dvojhmaty pre akord na danom nástroji
  // (najprv spodné dve struny, inak susedné vyššie).
  function candidates(chord, instId) {
    instId = instId || DEFAULT_INST;
    const rolePairs = chord.has7 ? PAIRS_SEVENTH : PAIRS_TRIAD;
    let out = buildCandidates(chord, rolePairs, STRING_PAIRS, instId);
    if (!out.length) out = buildCandidates(chord, rolePairs, FALLBACK_PAIRS, instId);
    // Posledná záchrana: ak nič hrateľné, povoľ aj nehrateľné (nech sa niečo ukáže).
    if (!out.length) out = buildCandidates(chord, rolePairs, STRING_PAIRS.concat(FALLBACK_PAIRS), instId, true);
    return out;
  }

  // Tóny dvojhmatu zoradené podľa struny (nižšia struna prvá).
  function byString(cand) {
    return cand.notes.slice().sort(function (a, b) { return a.stringIndex - b.stringIndex; });
  }

  function avgSemis(cand) {
    return (cand.notes[0].semis + cand.notes[1].semis) / 2;
  }

  // Mierne uprednostni nižšie polohy a prázdne struny (rozhoduje len pri remíze).
  function staticCost(cand) {
    return (cand.notes[0].semis + cand.notes[1].semis) * 0.05;
  }

  // Cena prechodu medzi dvoma dvojhmatmi = koľko sa musí pohnúť ruka.
  function transitionCost(a, b) {
    const A = byString(a), B = byString(b);
    const sameStrings = A[0].stringIndex === B[0].stringIndex && A[1].stringIndex === B[1].stringIndex;
    if (sameStrings) {
      return Math.abs(A[0].semis - B[0].semis) + Math.abs(A[1].semis - B[1].semis);
    }
    return SHIFT_PENALTY + Math.abs(avgSemis(a) - avgSemis(b));
  }

  // Pre postupnosť akordov vyberie dvojhmaty s minimálnym pohybom ruky (DP).
  function computeLine(chords, instId) {
    instId = instId || DEFAULT_INST;
    const cands = chords.map(function (c) { return candidates(c, instId); });
    const n = cands.length;
    if (!n) return [];

    const dp = [], back = [];
    for (let i = 0; i < n; i++) { dp.push([]); back.push([]); }

    cands[0].forEach(function (c, j) {
      dp[0][j] = staticCost(c);
      back[0][j] = -1;
    });

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

    const chosenIdx = new Array(n);
    let j = bj;
    for (let i = n - 1; i >= 0; i--) { chosenIdx[i] = j; j = back[i][j]; }
    const chosen = chosenIdx.map(function (idx, i) { return cands[i][idx]; });

    // Označ spoločné (držané) tóny: rovnaká struna aj poloha ako v predošlom akorde.
    for (let i = 0; i < n; i++) {
      chosen[i].notes.forEach(function (nt) {
        let held = false;
        if (i > 0) {
          held = chosen[i - 1].notes.some(function (pn) {
            return pn.stringIndex === nt.stringIndex && pn.semis === nt.semis;
          });
        }
        nt.held = held;
      });
    }

    return chosen.map(function (c, i) {
      return { chord: chords[i], dvojhmat: byString(c) };
    });
  }

  global.Kontra = {
    candidates: candidates,
    computeLine: computeLine
  };
})(window);

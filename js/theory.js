// theory.js — hudobná teória pre harmonizáciu ľudových piesní.
// Slovenské názvoslovie nôt: H = B, B = Bes (znížené H), prípony -is / -es.
(function (global) {
  'use strict';

  // 7 základných písmen (slovensko-nemecký systém) a ich pitch-class hodnoty.
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, H: 11 };

  // Názvy pri znížení / zvýšení o pol tóna (slovenská konvencia: H znížené = B).
  const LOWER = { C: 'Ces', D: 'Des', E: 'Es', F: 'Fes', G: 'Ges', A: 'As', H: 'B' };
  const RAISE = { C: 'Cis', D: 'Dis', E: 'Eis', F: 'Fis', G: 'Gis', A: 'Ais', H: 'His' };

  // Slovenský názov tónu podľa písmena a odchýlky v poltónoch (-2..+2).
  function spell(letter, delta) {
    if (delta === 0) return letter;
    if (delta === 1) return RAISE[letter];
    if (delta === -1) return LOWER[letter];
    if (delta === 2) return RAISE[letter] + 'is';
    if (delta === -2) return LOWER[letter] + 'es';
    return letter;
  }

  // Normalizuje rozdiel pitch-class do rozsahu -6..+5 (pre naše tóniny vyjde -2..+2).
  function normDelta(targetPc, letter) {
    const d = ((targetPc - LETTER_PC[letter]) % 12 + 12) % 12;
    return d > 6 ? d - 12 : d;
  }

  // Krokové vzorce stupníc v poltónoch od základného tónu.
  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]; // prirodzená (aeolská) moll

  // Vytvorí stupnicu so správnym slovenským zápisom.
  function buildScale(tonicLetter, tonicPc, steps) {
    const start = LETTERS.indexOf(tonicLetter);
    const scale = [];
    for (let i = 0; i < 7; i++) {
      const letter = LETTERS[(start + i) % 7];
      const pc = (tonicPc + steps[i]) % 12;
      scale.push({ name: spell(letter, normDelta(pc, letter)), pc: pc, letter: letter });
    }
    return scale;
  }

  // Zvýši tón o pol tóna pri zachovaní písmena (citlivý tón v moll dominante).
  function raiseSemitone(note) {
    const pc = (note.pc + 1) % 12;
    return { name: spell(note.letter, normDelta(pc, note.letter)), pc: pc, letter: note.letter };
  }

  // Definície tónin. tonicPc = pitch class základného tónu (po alterácii).
  const KEY_DEFS = [
    // dur
    { id: 'C-dur', display: 'C dur', mode: 'dur', tonicLetter: 'C', tonicPc: 0 },
    { id: 'G-dur', display: 'G dur', mode: 'dur', tonicLetter: 'G', tonicPc: 7 },
    { id: 'D-dur', display: 'D dur', mode: 'dur', tonicLetter: 'D', tonicPc: 2 },
    { id: 'A-dur', display: 'A dur', mode: 'dur', tonicLetter: 'A', tonicPc: 9 },
    { id: 'E-dur', display: 'E dur', mode: 'dur', tonicLetter: 'E', tonicPc: 4 },
    { id: 'F-dur', display: 'F dur', mode: 'dur', tonicLetter: 'F', tonicPc: 5 },
    { id: 'B-dur', display: 'B dur', mode: 'dur', tonicLetter: 'H', tonicPc: 10 }, // B = Bes
    // mol (prirodzená, dominanta sa harmonizuje so zvýšeným citlivým tónom)
    { id: 'a-mol', display: 'a mol', mode: 'mol', tonicLetter: 'A', tonicPc: 9 },
    { id: 'e-mol', display: 'e mol', mode: 'mol', tonicLetter: 'E', tonicPc: 4 },
    { id: 'd-mol', display: 'd mol', mode: 'mol', tonicLetter: 'D', tonicPc: 2 },
    { id: 'g-mol', display: 'g mol', mode: 'mol', tonicLetter: 'G', tonicPc: 7 },
    { id: 'h-mol', display: 'h mol', mode: 'mol', tonicLetter: 'H', tonicPc: 11 },
    { id: 'fis-mol', display: 'fis mol', mode: 'mol', tonicLetter: 'F', tonicPc: 6 },
    { id: 'c-mol', display: 'c mol', mode: 'mol', tonicLetter: 'C', tonicPc: 0 }
  ];

  // Predpočíta stupnicu pre každú tóninu.
  const KEYS = KEY_DEFS.map(function (d) {
    const steps = d.mode === 'dur' ? MAJOR_STEPS : MINOR_STEPS;
    return Object.assign({}, d, { scale: buildScale(d.tonicLetter, d.tonicPc, steps) });
  });

  function getKey(id) {
    return KEYS.find(function (k) { return k.id === id; }) || KEYS[0];
  }

  // Kvalita akordu podľa veľkej/malej tercie.
  function qualityOf(root, third) {
    return (third.pc - root.pc + 12) % 12 === 4 ? 'dur' : 'mol';
  }

  const ROLES = ['Základný tón', 'Tercia', 'Kvinta', 'Septima'];

  function withRoles(notes) {
    return notes.map(function (n, i) {
      return { name: n.name, pc: n.pc, letter: n.letter, role: ROLES[i] };
    });
  }

  // Triáda postavená na stupni stupnice (po terciách).
  function triadOnDegree(scale, degree) {
    const r = degree - 1;
    return [scale[r % 7], scale[(r + 2) % 7], scale[(r + 4) % 7]];
  }

  // Zostaví tri hlavné harmonické funkcie pre danú tóninu.
  function functionsFor(key) {
    const scale = key.scale;
    const isMinor = key.mode === 'mol';

    // Tonika a subdominanta sú diatonické triády na 1. a 4. stupni.
    const tTones = triadOnDegree(scale, 1);
    const sTones = triadOnDegree(scale, 4);

    // Dominanta: v moll zvýšime terciu (citlivý tón), pridáme septimu (4. stupeň).
    let dTones = triadOnDegree(scale, 5);
    if (isMinor) dTones = [dTones[0], raiseSemitone(dTones[1]), dTones[2]];
    const seventh = scale[3]; // 4. stupeň = septima dominanty
    const dWith7 = dTones.concat([seventh]);

    function chord(fn, fnName, abbr, tones, isDominant) {
      const root = tones[0];
      const q = qualityOf(tones[0], tones[1]);
      const noteObjs = withRoles(tones);
      const name = isDominant
        ? root.name + '7'
        : root.name + ' ' + q;
      return {
        fn: fn, fnName: fnName, abbr: abbr,
        name: name,
        quality: isDominant ? 'dur7' : q,
        notes: noteObjs,
        triad: noteObjs.slice(0, 3),
        // Kontrabas: základný tón a kvinta (typická basová alternácia).
        bass: [noteObjs[0], noteObjs[2]],
        // Kontra (viola): akordické tóny — triáda.
        kontra: noteObjs.slice(0, 3),
        hasSeventh: !!isDominant
      };
    }

    return {
      T: chord('T', 'Tonika', 'T', tTones, false),
      S: chord('S', 'Subdominanta', 'S', sTones, false),
      D: chord('D', 'Dominanta', 'D', dWith7, true)
    };
  }

  // Kvalita trojzvuku podľa tercie a kvinty (dur / mol / zmenšený / zväčšený).
  function triadQuality(notes) {
    const third = ((notes[1].pc - notes[0].pc) % 12 + 12) % 12;
    const fifth = ((notes[2].pc - notes[0].pc) % 12 + 12) % 12;
    if (third === 4 && fifth === 7) return 'dur';
    if (third === 3 && fifth === 7) return 'mol';
    if (third === 3 && fifth === 6) return 'dim';
    if (third === 4 && fifth === 8) return 'aug';
    return third === 4 ? 'dur' : 'mol';
  }

  const QUALITY_LABEL = { dur: 'dur', mol: 'mol', dim: 'zmenšený', aug: 'zväčšený' };

  // Ďalšie diatonické akordy v tónine (stupne mimo T/S/D: 2, 3, 6, 7) ako trojzvuky.
  // Tvar objektu je rovnaký ako pri functionsFor, aby ich UI vedelo vykresliť rovnako.
  function extraChords(key) {
    const scale = key.scale;
    return [2, 3, 6, 7].map(function (deg) {
      const tones = triadOnDegree(scale, deg);
      const q = triadQuality(tones);
      const noteObjs = withRoles(tones);
      return {
        degree: deg,
        fn: null,
        fnName: deg + '. stupeň',
        name: tones[0].name + ' ' + QUALITY_LABEL[q],
        quality: q,
        notes: noteObjs,
        triad: noteObjs.slice(0, 3),
        bass: [noteObjs[0], noteObjs[2]],
        kontra: noteObjs.slice(0, 3),
        hasSeventh: false,
        root: noteObjs[0]
      };
    });
  }

  // ---- Parser akordov z textu (pre tréner kontra linky) ----
  // Konvencia: veľké písmeno = dur, malé = mol. Prípony is/es (Cis, Es...),
  // samostatné B = Bes (znížené H). Koncové 7 = dominantný septakord.

  // Tón vzdialený o `stepLetters` písmen a `semis` poltónov od základného.
  function noteFrom(rootLetter, rootPc, stepLetters, semis) {
    const startIdx = LETTERS.indexOf(rootLetter);
    const letter = LETTERS[(startIdx + stepLetters) % 7];
    const pc = (rootPc + semis) % 12;
    return { name: spell(letter, normDelta(pc, letter)), pc: pc, letter: letter };
  }

  // Rozloží token na základné písmeno, alteráciu a kvalitu.
  function parseRoot(tok) {
    const first = tok[0];
    const upper = first.toUpperCase();
    const isUpper = first === upper && upper !== first.toLowerCase();
    let rest = tok.slice(1).toLowerCase();
    let has7 = false, dim = false;
    const suffix = rest.charAt(rest.length - 1);
    if (suffix === '7') {
      has7 = true;
      rest = rest.slice(0, -1);
    } else if (suffix === '0') {
      dim = true; // 0 = zmenšený (°)
      rest = rest.slice(0, -1);
    }

    let letter, delta;
    if (upper === 'B') {
      // B (aj b) = Bes = znížené H.
      if (rest !== '') return null;
      letter = 'H';
      delta = -1;
    } else if (LETTER_PC[upper] !== undefined) {
      letter = upper;
      if (rest === '') delta = 0;
      else if (rest === 'is') delta = 1;
      else if (rest === 'es' || rest === 's') delta = -1; // Es, As aj Des, Ges...
      else return null;
    } else {
      return null;
    }

    const rootPc = ((LETTER_PC[letter] + delta) % 12 + 12) % 12;
    return { letter: letter, delta: delta, rootPc: rootPc, quality: dim ? 'dim' : (isUpper ? 'dur' : 'mol'), has7: has7 };
  }

  // Z tokenu zostaví akord (notes s rolami) alebo vráti null.
  function parseChord(token) {
    const tok = String(token).trim();
    if (!tok) return null;
    const r = parseRoot(tok);
    if (!r) return null;

    const thirdSemis = r.quality === 'dur' ? 4 : 3;   // dur = veľká, mol/dim = malá tercia
    const fifthSemis = r.quality === 'dim' ? 6 : 7;   // dim = zmenšená, inak čistá kvinta
    const tones = [
      noteFrom(r.letter, r.rootPc, 0, 0),          // základný tón
      noteFrom(r.letter, r.rootPc, 2, thirdSemis), // tercia
      noteFrom(r.letter, r.rootPc, 4, fifthSemis)  // kvinta
    ];
    if (r.has7) tones.push(noteFrom(r.letter, r.rootPc, 6, 10)); // malá septima

    const noteObjs = withRoles(tones);
    return {
      token: tok,
      quality: r.quality,
      has7: r.has7,
      notes: noteObjs,
      root: noteObjs[0],
      third: noteObjs[1],
      fifth: noteObjs[2],
      seventh: r.has7 ? noteObjs[3] : null
    };
  }

  // Rozparsuje postupnosť akordov (oddelené medzerou/čiarkou).
  function parseProgression(text) {
    const tokens = String(text).split(/[\s,]+/).filter(function (t) { return t.length; });
    const chords = [];
    const errors = [];
    tokens.forEach(function (t) {
      const ch = parseChord(t);
      if (ch) chords.push(ch);
      else errors.push(t);
    });
    return { chords: chords, errors: errors };
  }

  // ---- Ľubovoľný akord podľa pitch-class (pre podstránku „Hmaty akordov") ----
  // Pre vyhľadanie hmatu nie je dôležitý presný enharmonický zápis, ale čitateľnosť,
  // preto používame jednoduché chromatické názvy bez dvojitých posuviek.
  const CHROMATIC = ['C', 'Cis', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'B', 'H'];

  function pcName(pc) {
    return CHROMATIC[((pc % 12) + 12) % 12];
  }

  // Intervaly (poltóny) tercie a kvinty podľa druhu akordu.
  const CHORD_INTERVALS = {
    dur:  { third: 4, fifth: 7 },
    mol:  { third: 3, fifth: 7 },
    dur7: { third: 4, fifth: 7 },
    dim:  { third: 3, fifth: 6 },
    aug:  { third: 4, fifth: 8 }
  };

  // Zostaví akord z ľubovoľného základného tónu (pitch class) a druhu.
  // Tvar objektu je kompatibilný s vykreslením detailu (notes s rolami, bass, kontra).
  function chordFromPc(rootPc, quality) {
    const iv = CHORD_INTERVALS[quality] || CHORD_INTERVALS.dur;
    const pcs = [rootPc, rootPc + iv.third, rootPc + iv.fifth];
    if (quality === 'dur7') pcs.push(rootPc + 10); // malá septima
    const notes = pcs.map(function (pc, i) {
      return { name: pcName(pc), pc: ((pc % 12) + 12) % 12, role: ROLES[i] };
    });
    const rootName = pcName(rootPc);
    const NAME = {
      dur: rootName + ' dur', mol: rootName + ' mol', dur7: rootName + '7',
      dim: rootName + ' zmenšený', aug: rootName + ' zväčšený'
    };
    return {
      name: NAME[quality] || (rootName + ' ' + quality),
      quality: quality,
      notes: notes,
      triad: notes.slice(0, 3),
      bass: [notes[0], notes[2]],
      kontra: notes.slice(0, 3),
      hasSeventh: quality === 'dur7'
    };
  }

  global.Theory = {
    KEYS: KEYS,
    getKey: getKey,
    functionsFor: functionsFor,
    extraChords: extraChords,
    parseChord: parseChord,
    parseProgression: parseProgression,
    pcName: pcName,
    chordFromPc: chordFromPc
  };
})(window);

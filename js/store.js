// store.js — ukladanie piesní do localStorage (Fáza 1).
// Dátový model piesne:
//   { id, title, key, tempo, timeSig, style, region, difficulty, videoUrl,
//     bars: [ { chords: ["a","a"] }, ... ], createdAt, updatedAt }
// Akordy sú tokeny, ktoré pozná Theory.parseChord ("a", "G7", "g0", "Cis"...).
// Neskôr sa localStorage vymení za backend — API ostane rovnaké.
(function (global) {
  'use strict';

  const KEY = 'harmonizacia.songs.v1';
  const SEEDED = 'harmonizacia.seeded.v1';

  function uid() {
    return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }
  function now() { return new Date().toISOString(); }

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeAll(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr)); return true; }
    catch (e) { return false; }
  }

  // Prázdna pieseň pre editor.
  function blank() {
    return {
      id: null,
      title: '',
      key: 'C-dur',
      tempo: 104,
      timeSig: '2/4',
      accomp: 'estam',
      artic: 'auto',
      accent: '',
      lengths: '',
      style: '',
      region: '',
      difficulty: 'zaciatocnik',
      videoUrl: '',
      bars: [ { chords: [] } ],
      createdAt: null,
      updatedAt: null
    };
  }

  function list() {
    return readAll().slice().sort(function (a, b) {
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  }
  function get(id) {
    return readAll().find(function (s) { return s.id === id; }) || null;
  }
  function save(song) {
    const all = readAll();
    const s = Object.assign({}, song);
    if (!s.id) { s.id = uid(); s.createdAt = now(); }
    s.updatedAt = now();
    const i = all.findIndex(function (x) { return x.id === s.id; });
    if (i >= 0) all[i] = s; else all.push(s);
    writeAll(all);
    return s;
  }
  function remove(id) {
    writeAll(readAll().filter(function (s) { return s.id !== id; }));
  }

  // Počet akordov v celej piesni (pre pomocné výpisy).
  function chordCount(song) {
    return (song.bars || []).reduce(function (n, b) { return n + (b.chords ? b.chords.filter(Boolean).length : 0); }, 0);
  }
  // Štýly spodkov (rytmický sprievod basy a kontry) podľa J. Ambrózovej:
  // Analýza rytmického sprievodu v ľudových hudbách na Slovensku (Musicologica Slovaca, 2011),
  // príklad 1 (kontra a–e) a príklad 2 (kontrabas a–d). Rytmy samotné sú v audio.js.
  const ACCOMP = [
    { id: 'estam',  label: 'Es‑tam (esta)',                 desc: 'Rýchle tempo: basa krátko na dobu, kontra na ľahkú osminu medzi dobami.' },
    { id: 'duvaj8', label: 'Duvaj osminový (dvojitý)',      desc: 'Starší štýl: v každej dobe dve osminy v jednom ťahu sláčika, oddelené krátkym pozastavením; párna (druhá) je prízvučná — basa aj kontra spolu. V miernom tempe je prvá osmina kratšia (asymetria), s rastúcim tempom sa vyrovnáva.' },
    { id: 'duvaj4', label: 'Duvaj štvrťový (čardáš)',       desc: 'Nový štýl: štvrťové noty viazané po dvoch, druhá prízvučná — basa aj kontra spolu.' },
    { id: 'stvrte', label: 'Štvrťové neviazané (krútivé)',  desc: 'Archaický: kontra aj basa štvrťová na každú dobu, každá zvlášť.' },
    { id: 'osminy', label: 'Osminy neviazané',              desc: 'Kontra štyri samostatné osminy v takte, basa štvrťová na dobu.' },
    { id: 'valcik', label: 'Valčík (3/4)',                  desc: 'Basa na 1. dobu, kontra na 2. a 3. dobu.' }
  ];
  // Artikulácia es-tamu a valčíka (Ambrózová, príloha B: S, T, P).
  const ARTIC = [
    { id: 'auto',     label: 'Podľa tempa (odporúčané)' },
    { id: 'staccato', label: 'Staccato — krátko, sekom' },
    { id: 'tenuto',   label: 'Tenuto — plná dĺžka' },
    { id: 'presah',   label: 'Presah — tón až po ďalší úder' }
  ];
  // Automatická voľba podľa tempa — tempá hráčov v štúdii: P 80–100, S 100–150, T 180–190.
  function resolveArtic(artic, bpm) {
    if (artic && artic !== 'auto') return artic;
    if (bpm >= 170) return 'tenuto';
    if (bpm < 100) return 'presah';
    return 'staccato';
  }
  // Prízvukovanie (kritérium 2 v štúdii; číslice = jednotky modelu v poradí):
  // 1 = bez výrazného prízvuku (len zmena ťahu), 2 = vedomý prízvuk. Prvá voľba je predvolená.
  // Osminový duvaj: 1212 je východiskový model, 2222 a 2121 sa v tabuľke hráčov (príloha C)
  // vyskytujú rovnako často. Štvrťový duvaj: obaja meraní hráči (príloha A) hrali 2222.
  const ACCENTS = {
    duvaj8: [
      { id: '1212', label: '1212 — prízvuk na párnych osminách (východiskový)' },
      { id: '2222', label: '2222 — všetky osminy rovnako' },
      { id: '2121', label: '2121 — ťah 1)(23)(4, prízvuk na nepárnych' }
    ],
    duvaj4: [
      { id: '2222', label: '2222 — všetky štvrťové rovnako (merané hry)' },
      { id: '1212', label: '1212 — každá druhá prízvučná (notový príklad)' }
    ]
  };
  // Dĺžky osmín osminového duvaja (kritérium 3 v štúdii): xxxx = rovnako dlhé,
  // kdxx = v prvom poltaktí prvá osmina kratšia. V tabuľke hráčov ide 2222 prevažne
  // s xxxx, 1212 s kdxx — preto predvolené podľa prízvukovania.
  const LENGTHS = [
    { id: 'kdxx', label: 'kdxx — prvá osmina kratšia' },
    { id: 'xxxx', label: 'xxxx — všetky rovnako dlhé' }
  ];
  function defaultLengths(accent) { return accent === '2222' ? 'xxxx' : 'kdxx'; }
  // Dĺžky osmín piesne (null, ak štýl nie je osminový duvaj).
  function lengthsOf(song) {
    if (accompOf(song) !== 'duvaj8') return null;
    if (song.lengths === 'kdxx' || song.lengths === 'xxxx') return song.lengths;
    return defaultLengths(accentOf(song));
  }

  // Prízvukovanie piesne pre jej štýl (null, ak sa štýlu netýka).
  function accentOf(song) {
    const list = ACCENTS[accompOf(song)];
    if (!list) return null;
    return list.some(function (a) { return a.id === song.accent; }) ? song.accent : list[0].id;
  }

  // Štýl piesne; staršie piesne bez nastavenia odhadne zo žánru a metra.
  function accompOf(song) {
    if (song.accomp && ACCOMP.some(function (a) { return a.id === song.accomp; })) return song.accomp;
    const st = (song.style || '').toLowerCase();
    if (song.timeSig === '3/4') return 'valcik';
    if (st.indexOf('duvaj') !== -1) return 'duvaj8';
    if (st.indexOf('čardáš') !== -1 || st.indexOf('cardas') !== -1) return 'duvaj4';
    return 'estam';
  }

  // Počet políčok (dôb) v takte podľa metra. 6/8 sa v ľudovke počíta „na dve".
  function slotsFor(timeSig) {
    const map = { '2/4': 2, '3/4': 3, '4/4': 4, '6/8': 2 };
    return map[timeSig] || 2;
  }
  // Zarovná každý takt na presný počet políčok ('' = prázdne políčko).
  function normalizeSlots(song) {
    const n = slotsFor(song.timeSig);
    (song.bars || []).forEach(function (b) {
      const c = (b.chords || []).slice(0, n);
      while (c.length < n) c.push('');
      b.chords = c;
    });
    return song;
  }
  // Akordy zoradom (jeden na políčko) — pre prehrávanie a náhľad.
  // Prázdne políčko pokračuje predchádzajúcim akordom (akord v 1. políčku platí
  // pre celý takt). Voliteľne len takty from..to (vrátane).
  function flatChords(song, from, to) {
    const bars = song.bars || [];
    const a = from == null ? 0 : from;
    const b = to == null ? bars.length - 1 : to;
    const out = [];
    let last = '';
    bars.forEach(function (bar, ti) {
      (bar.chords || []).forEach(function (c) {
        if (c) last = c;
        if (ti >= a && ti <= b && last) out.push(last);
      });
    });
    return out;
  }

  // Jedna položka na každé políčko (dobu) taktov from..to: token akordu, ktorý v tej
  // dobe znie (prázdne políčko drží predchádzajúci), alebo null, kým žiadny akord nezaznel.
  function slotChords(song, from, to) {
    const bars = song.bars || [];
    const a = from == null ? 0 : from;
    const b = to == null ? bars.length - 1 : to;
    const out = [];
    let last = null;
    bars.forEach(function (bar, ti) {
      (bar.chords || []).forEach(function (c) {
        if (c && global.Theory && global.Theory.parseChord(c)) last = c;
        if (ti >= a && ti <= b) out.push(last);
      });
    });
    return out;
  }

  function exportJSON() { return JSON.stringify(readAll(), null, 2); }
  function importJSON(str, replace) {
    let incoming;
    try { incoming = JSON.parse(str); } catch (e) { return { ok: false, error: 'Neplatný JSON' }; }
    if (!Array.isArray(incoming)) return { ok: false, error: 'Očakával sa zoznam piesní' };
    if (replace) { writeAll(incoming); return { ok: true, count: incoming.length }; }
    const all = readAll();
    const byId = {};
    all.forEach(function (s) { byId[s.id] = true; });
    incoming.forEach(function (s) { if (!s.id || byId[s.id]) s.id = uid(); all.push(s); });
    writeAll(all);
    return { ok: true, count: incoming.length };
  }

  // Ukážkové piesne pri prvom spustení (nech knižnica nie je prázdna).
  const SAMPLES = [
    { title: 'A keď sa ja', key: 'a-mol', tempo: 100, timeSig: '2/4',
      style: 'Horehronský duvaj', region: 'Horehronie', difficulty: 'zaciatocnik', videoUrl: '',
      bars: [ {chords:['a','a']}, {chords:['d','d']}, {chords:['E7','E7']}, {chords:['a','a']} ] },
    { title: 'Tancuj, tancuj', key: 'G-dur', tempo: 132, timeSig: '2/4',
      style: 'Čardáš', region: 'Zemplín', difficulty: 'mierne', videoUrl: '',
      bars: [ {chords:['G','G']}, {chords:['D7','D7']}, {chords:['G','G']}, {chords:['C','G']} ] },
    { title: 'Kysucký valčík', key: 'D-dur', tempo: 116, timeSig: '3/4',
      style: 'Valčík', region: 'Kysuce', difficulty: 'zaciatocnik', videoUrl: '',
      bars: [ {chords:['D','D','D']}, {chords:['A7','A7','A7']}, {chords:['D','D','D']}, {chords:['A7','A7','D']} ] }
  ];
  function seedIfEmpty() {
    try {
      if (localStorage.getItem(SEEDED)) return;
      if (readAll().length === 0) {
        SAMPLES.forEach(function (s) { save(s); });
      }
      localStorage.setItem(SEEDED, '1');
    } catch (e) { /* súkromný režim a pod. */ }
  }

  seedIfEmpty();

  global.Store = {
    blank: blank,
    list: list,
    get: get,
    save: save,
    remove: remove,
    chordCount: chordCount,
    flatChords: flatChords,
    slotChords: slotChords,
    ACCOMP: ACCOMP,
    accompOf: accompOf,
    ARTIC: ARTIC,
    ACCENTS: ACCENTS,
    accentOf: accentOf,
    LENGTHS: LENGTHS,
    defaultLengths: defaultLengths,
    lengthsOf: lengthsOf,
    resolveArtic: resolveArtic,
    slotsFor: slotsFor,
    normalizeSlots: normalizeSlots,
    exportJSON: exportJSON,
    importJSON: importJSON
  };
})(window);

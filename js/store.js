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
    slotsFor: slotsFor,
    normalizeSlots: normalizeSlots,
    exportJSON: exportJSON,
    importJSON: importJSON
  };
})(window);

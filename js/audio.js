// audio.js — zvukový engine postavený na Tone.js (vzorkované nástroje).
// Prehráva reálne nahrávky: kontrabas (bas) a violu (kontra) cez Tone.Sampler,
// takže zvuk = skutočný sláčikový nástroj, nie syntetický oscilátor.
// Verejné API ostáva rovnaké (global.Sound): playNote / playChord /
// playProgression / stop / isReady. Postupnosť hrá ako kapelu (umca-umca) cez
// Tone.Transport; používa tie isté Bass/Kontra linky ako tréneri.
// Pozn.: globál NEpomenovať „Audio" — koliduje so vstavaným objektom prehliadača.
(function (global) {
  'use strict';

  const Tone = global.Tone;
  // Anglické názvy tónov (s krížikmi) pre Tone — pitch class 0..11 = C..H.
  const NOTE_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  let started = false;     // Tone.start() prebehol (po geste používateľa)
  let out = null;          // limiter na výstupe (ochrana proti clippingu)
  let viola = null;        // Tone.Sampler — kontra (viola)
  let bass = null;         // Tone.Sampler — kontrabas

  // Vytvorí vzorkové nástroje (raz). Vzorky sa načítavajú hneď pri štarte stránky,
  // aby boli pripravené, kým používateľ klikne; Tone kontext sa rozbehne až gestom.
  function makeInstruments() {
    if (viola || !Tone) return;
    out = new Tone.Limiter(-2).toDestination();

    viola = new Tone.Sampler({
      urls: { C3: 'C3.mp3', E3: 'E3.mp3', G3: 'G3.mp3', A3: 'A3.mp3',
              C4: 'C4.mp3', E4: 'E4.mp3', G4: 'G4.mp3', A4: 'A4.mp3', C5: 'C5.mp3' },
      baseUrl: 'samples/viola/',
      release: 0.6
    }).connect(out);
    viola.volume.value = -8;

    bass = new Tone.Sampler({
      urls: { G1: 'G1.mp3', 'A#1': 'As1.mp3', C2: 'C2.mp3', D2: 'D2.mp3',
              E2: 'E2.mp3', 'F#2': 'Fs2.mp3', 'G#2': 'Gs2.mp3', A2: 'A2.mp3',
              'C#3': 'Cs3.mp3' },
      baseUrl: 'samples/contrabass/',
      release: 0.8
    }).connect(out);
    bass.volume.value = -3;
  }

  // Rozbehne zvuk po geste používateľa (klik). Tone.start() musí byť v geste.
  function ensureStarted() {
    makeInstruments();
    if (!started && Tone) { Tone.start(); started = true; }
  }

  function instFor(voice) { return voice === 'bass' ? bass : viola; }

  // Pitch classy do stúpajúceho rozloženia (close voicing) od baseOct nahor — MIDI čísla.
  function voiceUpMidi(pcs, baseOct) {
    let oct = baseOct, prev = -Infinity;
    return pcs.map(function (pc) {
      let midi = (oct + 1) * 12 + pc;
      while (midi <= prev) { oct++; midi = (oct + 1) * 12 + pc; }
      prev = midi;
      return midi;
    });
  }

  function midiToNote(m) { return Tone.Frequency(m, 'midi').toNote(); }
  function noteOf(pc, octave) { return NOTE_EN[pc] + octave; }

  // Zastaví všetko: zastaví a vyčistí Transport a utlmí znejúce tóny.
  function stopAll() {
    if (!Tone) return;
    try {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      Tone.Transport.position = 0;
    } catch (e) { /* nič */ }
    if (viola && viola.loaded) viola.releaseAll();
    if (bass && bass.loaded) bass.releaseAll();
  }

  // ---- Verejné API ----

  function playNote(pc, opts) {
    opts = opts || {};
    ensureStarted(); stopAll();
    const inst = instFor(opts.voice);
    if (!inst || !inst.loaded) return;
    const note = noteOf(pc, opts.octave == null ? 3 : opts.octave);
    inst.triggerAttackRelease(note, opts.duration || 0.9);
  }

  function playChord(pcs, opts) {
    opts = opts || {};
    if (!pcs || !pcs.length) return;
    ensureStarted(); stopAll();
    const inst = instFor(opts.voice);
    if (!inst || !inst.loaded) return;
    const notes = voiceUpMidi(pcs, opts.octave == null ? 3 : opts.octave).map(midiToNote);
    inst.triggerAttackRelease(notes, opts.duration || 1.3);
  }

  // Prehrá postupnosť. opts.mode:
  //   'bass'  — len basa, jeden držaný tón cez celý takt (na učenie prstokladu),
  //   'band' (predvolené) — kapela: bas na ťažkú dobu + kontra na ľahkú (umca-umca).
  // Používa rovnaké linky ako tréneri (Bass / Kontra) — zvuk = čo vidíš na obrazovke.
  function playProgression(chords, opts) {
    opts = opts || {};
    if (!chords || !chords.length || !Tone) return 0;
    ensureStarted(); stopAll();

    const bpm = opts.bpm || 104;
    Tone.Transport.bpm.value = bpm;
    const beat = 60 / bpm, barLen = beat * 4;
    const bassLine = global.Bass ? global.Bass.computeLine(chords) : [];

    if (opts.mode === 'bass') {
      chords.forEach(function (ch, i) {
        const p = bassLine[i] ? bassLine[i].bass[0] : null;
        if (!p) return;
        const note = noteOf(p.pc, 2);
        Tone.Transport.schedule(function (time) {
          if (bass && bass.loaded) bass.triggerAttackRelease(note, barLen * 0.92, time, 0.9);
        }, i + ':0:0');
      });
    } else {
      const kontraLine = global.Kontra ? global.Kontra.computeLine(chords) : [];
      chords.forEach(function (ch, i) {
        const bp = bassLine[i] ? bassLine[i].bass[0] : null;
        const bnote = bp ? noteOf(bp.pc, 2) : null;
        const knotes = kontraLine[i]
          ? voiceUpMidi(kontraLine[i].dvojhmat.map(function (n) { return n.pc; }), 3).map(midiToNote)
          : [];

        [0, 2].forEach(function (b) { // bas na 1. a 3. dobe
          if (!bnote) return;
          Tone.Transport.schedule(function (time) {
            if (bass && bass.loaded) bass.triggerAttackRelease(bnote, beat * 0.9, time, 0.95);
          }, i + ':' + b + ':0');
        });
        [1, 3].forEach(function (b) { // kontra na 2. a 4. dobe
          if (!knotes.length) return;
          Tone.Transport.schedule(function (time) {
            if (viola && viola.loaded) viola.triggerAttackRelease(knotes, beat * 0.7, time, 0.8);
          }, i + ':' + b + ':0');
        });
      });
    }

    // Po dohraní postupnosti Transport sám zastav.
    Tone.Transport.schedule(function () { stopAll(); }, chords.length + ':0:0');
    Tone.Transport.start('+0.1');
    return chords.length;
  }

  global.Sound = {
    playNote: playNote,
    playChord: playChord,
    playProgression: playProgression,
    stop: stopAll,
    isReady: function () { return !!(viola && viola.loaded && bass && bass.loaded); }
  };

  // Prednačítaj vzorky hneď (kontext sa rozbehne až gestom).
  makeInstruments();
})(window);

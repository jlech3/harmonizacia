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

  // Doznievanie tónu po pustení (s). Tréneri (jeden tón / akord) nechajú tón dozniet;
  // spodky musia mať doznievanie krátke ako zdvihnutie sláčika — inak by dlhý dozvuk
  // prekryl dĺžky a pozastavenia zo štúdie (staccato, pauza za nepárnou osminou duvaja…).
  const REL_TRAINER = { viola: 0.6, bass: 0.8 };
  const REL_SLOTS = { viola: 0.1, bass: 0.15 };
  function setRelease(r) {
    if (viola) viola.release = r.viola;
    if (bass) bass.release = r.bass;
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
      Tone.Transport.loop = false;
      Tone.Transport.position = 0;
    } catch (e) { /* nič */ }
    if (viola && viola.loaded) viola.releaseAll();
    if (bass && bass.loaded) bass.releaseAll();
  }

  // ---- Verejné API ----

  function playNote(pc, opts) {
    opts = opts || {};
    ensureStarted(); stopAll(); setRelease(REL_TRAINER);
    const inst = instFor(opts.voice);
    if (!inst || !inst.loaded) return;
    const note = noteOf(pc, opts.octave == null ? 3 : opts.octave);
    inst.triggerAttackRelease(note, opts.duration || 0.9);
  }

  function playChord(pcs, opts) {
    opts = opts || {};
    if (!pcs || !pcs.length) return;
    ensureStarted(); stopAll(); setRelease(REL_TRAINER);
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
    ensureStarted(); stopAll(); setRelease(REL_TRAINER);

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

  // ---- Prehrávanie po dobách (editor / pieseň) ----
  // Štýly spodkov podľa J. Ambrózovej (Musicologica Slovaca 2011), príklad 1 (kontra)
  // a príklad 2 (kontrabas). Políčko = jedna doba (štvrťová). Pre dobu b v takte vráti
  // údery { f: posun v dobe (0..1), v: 'bass'|'kontra', len: dĺžka v dobách, vel: sila }.
  // Pri duvaji hrajú basa a kontra rytmicky spolu, prízvuk je na druhej z dvojice.
  function both(ev) { return [Object.assign({ v: 'bass' }, ev), Object.assign({ v: 'kontra' }, ev)]; }
  const ACC = 0.95, MID = 0.8;
  // Dĺžky tónov podľa artikulácie (príloha B štúdie): staccato = sekom, tenuto = plná
  // dĺžka, presah = tón trvá až po nasledujúci úder.
  const ESTAM_LEN = { staccato: 0.2, tenuto: 0.42, presah: 0.49 };   // v dobách (úder každú pol dobu)
  const VALCIK_LEN = { staccato: 0.25, tenuto: 0.6, presah: 0.95 };  // úder každú dobu
  // Sila úderu podľa stupňa prízvukovania (kritérium 2 v štúdii): 0 = bez prízvuku,
  // takmer zaniká; 1 = bez výrazného prízvuku, len zmena ťahu; 2 = vedomý prízvuk; 3 = najväčší.
  // Rozdiel 1 ↔ 2 musí byť jasne počuť (~ -5 dB): 1 = „len zmena ťahu", 2 = vedomý prízvuk.
  const LEVEL = { '0': 0.3, '1': 0.55, '2': 0.95, '3': 1.0 };
  function lvl(pattern, i) { return LEVEL[pattern.charAt(i % pattern.length)] || LEVEL['2']; }
  // Mierne tempo = 0, rýchle (≥160 BPM) = 1 — pri rýchlom tempe sa dĺžky vyrovnávajú.
  function fastness(bpm) { return Math.min(1, Math.max(0, (bpm - 100) / 60)); }
  const STYLES = {
    // 1e + 2a: basa na dobu, kontra na ľahkú osminu medzi dobami; dĺžka podľa artikulácie.
    estam: function (b, ctx) {
      const len = ESTAM_LEN[ctx.artic] || ESTAM_LEN.staccato;
      return [{ f: 0, v: 'bass', len: len, vel: ACC }, { f: 0.5, v: 'kontra', len: len, vel: MID }];
    },
    // 1b + 2c: osminový duvaj, takt 2/4 = 4 osminové jednotky (dve na dobu).
    // Dĺžky podľa slovenského modelu „kdxx": v prvom poltaktí prvá osmina kratšia
    // (~37:63 v miernom tempe), druhé poltaktie súmerné; navyše prvé poltaktie mierne
    // kratšie než druhé (12:13, D. Holý). S rastúcim tempom sa všetko vyrovnáva.
    // Prízvuky: 1212 / 2222 / 2121 (príloha C). Ťah sláčika (príloha B, kritérium 1):
    // pri 1212 a 2222 variant A = (1'2)(3'4) — dve osminy v jednom ťahu, oddelené
    // pozastavením sláčika za nepárnou osminou; zmena ťahu za párnou je bez pauzy.
    // Pri 2121 ťah 1)'(23)'(4 — pauza za 1. a 3. osminou (pri zmene ťahu), 2.→3. a 4.→1.
    // legato. V oboch prípadoch teda: nepárna osmina skrátená pauzou, párna znie až
    // po ďalšiu osminu.
    duvaj8: function (b, ctx) {
      // xxxx = všetky osminy rovnako dlhé (aj poltaktia) — ako pri rýchlom tempe.
      const t = ctx.lengths === 'xxxx' ? 1 : fastness(ctx.bpm);
      const shift = 0.04 * (1 - t);                // 12:13 medzi poltaktiami
      const first = b % 2 === 0;
      const start = first ? 0 : -shift;             // druhé poltaktie nastúpi o kúsok skôr
      const pol = first ? 1 - shift : 1 + shift;    // dĺžka poltaktia v dobách
      const cut = first ? 0.37 + 0.13 * t : 0.5;    // kde v poltaktí nastúpi druhá osmina
      const d1 = cut * pol, d2 = (1 - cut) * pol;
      const acc = ctx.accent || '1212';
      const u = (b % 2) * 2;                        // poradie prvej osminy tejto doby v takte (0 / 2)
      const pause = 0.06;                           // pozastavenie sláčika za nepárnou osminou
      return both({ f: start, len: d1 - pause, vel: lvl(acc, u) })
        .concat(both({ f: start + d1, len: d2, vel: lvl(acc, u + 1) }));
    },
    // 1d + 2d: štvrťový duvaj — štvrťové viazané po dvoch (12)(34): prvá štvrť znie až po
    // druhú (legato v ťahu), za druhou zmena ťahu s krátkym zdvihnutím sláčika.
    // Prízvuk 2222 (merané hry, predvolené) alebo 1212 (notový príklad 1d).
    duvaj4: function (b, ctx) {
      const acc = ctx.accent || '2222';
      const endOfStroke = b % 2 === 1;
      return both({ f: 0, len: endOfStroke ? 0.9 : 1.0, vel: lvl(acc, b) });
    },
    // 1a + 2b: štvrťové na každú dobu, každá zvlášť.
    stvrte: function () {
      return [{ f: 0, v: 'bass', len: 0.85, vel: ACC }, { f: 0, v: 'kontra', len: 0.8, vel: MID }];
    },
    // 1c + 2b: kontra dve samostatné osminy v dobe, basa štvrťová na dobu.
    osminy: function () {
      return [{ f: 0, v: 'bass', len: 0.85, vel: ACC },
              { f: 0, v: 'kontra', len: 0.4, vel: MID }, { f: 0.5, v: 'kontra', len: 0.4, vel: MID }];
    },
    // Valčík 3/4: basa na 1. dobu, kontra na 2. a 3.; dĺžka podľa artikulácie
    // (hráči v štúdii ho hrali staccato ako es-tam).
    valcik: function (b, ctx) {
      const len = VALCIK_LEN[ctx.artic] || VALCIK_LEN.staccato;
      return b === 0 ? [{ f: 0, v: 'bass', len: Math.max(len, 0.5), vel: ACC }] : [{ f: 0, v: 'kontra', len: len, vel: MID }];
    }
  };
  const BEATS = { '2/4': 2, '3/4': 3, '4/4': 4, '6/8': 2 };

  // Vizuálna zmena presne vtedy, keď zaznie úder (time = čas zvukového kontextu).
  // Obyčajný časovač namiesto Tone.Draw — funguje aj keď prehliadač nekreslí animácie.
  function drawAt(time, fn) {
    setTimeout(fn, Math.max(0, (time - Tone.now()) * 1000));
  }

  // slots: pole akordov (objekty z Theory.parseChord) alebo null (ticho) — jedna položka = jedna doba.
  // opts: { bpm, meter: '2/4'…, style: 'estam'|'duvaj8'|…, artic: 'auto'|'staccato'|…,
  //         accent: '1212'|'2222', mode: 'band'|'bass',
  //         inst: 'viola'|'husle', loop: bool, onStep: fn(i) }
  // mode 'bass' = len basová časť štýlu (bez kontry).
  // onStep(i) sa volá na začiatku každej doby; onStep(-1) po dohraní (bez slučky).
  function playSlots(slots, opts) {
    opts = opts || {};
    if (!slots || !slots.length || !Tone) return 0;
    ensureStarted(); stopAll(); setRelease(REL_SLOTS);

    const perBar = BEATS[opts.meter] || 2;
    const beat = 60 / (opts.bpm || 104);
    const pattern = STYLES[opts.style] || STYLES.estam;
    const bpm = opts.bpm || 104;
    const ctx = {
      bpm: bpm,
      artic: global.Store && global.Store.resolveArtic ? global.Store.resolveArtic(opts.artic, bpm) : 'staccato',
      accent: opts.accent || null,
      lengths: opts.lengths || 'kdxx'
    };

    // Linky počítame len z akordov (bez tichých dôb), potom ich namapujeme späť na doby.
    const chords = [];
    const idx = slots.map(function (c) { if (!c) return -1; chords.push(c); return chords.length - 1; });
    const bassLine = global.Bass ? global.Bass.computeLine(chords) : [];
    const kontraLine = global.Kontra ? global.Kontra.computeLine(chords, opts.inst || 'viola') : [];

    slots.forEach(function (c, i) {
      const t0 = i * beat;
      if (opts.onStep) drawAtLater(t0, i);
      const k = idx[i];
      if (k < 0) return;
      const bp = bassLine[k] ? bassLine[k].bass[0] : null;
      const bnote = bp ? noteOf(bp.pc, 2) : null;
      const knotes = kontraLine[k]
        ? voiceUpMidi(kontraLine[k].dvojhmat.map(function (n) { return n.pc; }), 3).map(midiToNote)
        : [];
      pattern(i % perBar, ctx).forEach(function (ev) {
        const at = t0 + ev.f * beat;
        const len = beat * ev.len;
        if (ev.v === 'bass' && bnote) {
          Tone.Transport.schedule(function (time) {
            if (bass && bass.loaded) bass.triggerAttackRelease(bnote, len, time, ev.vel);
          }, at);
        } else if (ev.v === 'kontra' && opts.mode !== 'bass' && knotes.length) {
          Tone.Transport.schedule(function (time) {
            if (viola && viola.loaded) viola.triggerAttackRelease(knotes, len, time, ev.vel);
          }, at);
        }
      });
    });

    function drawAtLater(t, i) {
      Tone.Transport.schedule(function (time) { drawAt(time, function () { opts.onStep(i); }); }, t);
    }

    const total = slots.length * beat;
    if (opts.loop) {
      Tone.Transport.loop = true;
      Tone.Transport.loopStart = 0;
      Tone.Transport.loopEnd = total;
    } else {
      Tone.Transport.schedule(function (time) {
        if (opts.onStep) drawAt(time, function () { opts.onStep(-1); });
        stopAll();
      }, total);
    }
    Tone.Transport.start('+0.1');
    return total;
  }

  global.Sound = {
    playNote: playNote,
    playChord: playChord,
    playProgression: playProgression,
    playSlots: playSlots,
    stop: stopAll,
    isReady: function () {
      return !!(viola && viola.loaded && bass && bass.loaded);
    }
  };

  // Prednačítaj vzorky hneď (kontext sa rozbehne až gestom).
  makeInstruments();
})(window);

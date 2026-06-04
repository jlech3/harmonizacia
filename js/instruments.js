// instruments.js — ladenie nástrojov a výpočet hmatov v 1. polohe.
(function (global) {
  'use strict';

  // Struny zdola nahor (od najhrubšej). pc = pitch class prázdnej struny.
  const INSTRUMENTS = {
    husle: {
      id: 'husle',
      name: 'Husle (prim)',
      // G – D – A – E
      strings: [
        { name: 'G', pc: 7 },
        { name: 'D', pc: 2 },
        { name: 'A', pc: 9 },
        { name: 'E', pc: 4 }
      ]
    },
    viola: {
      id: 'viola',
      name: 'Viola (kontra)',
      // C – G – D – A
      strings: [
        { name: 'C', pc: 0 },
        { name: 'G', pc: 7 },
        { name: 'D', pc: 2 },
        { name: 'A', pc: 9 }
      ]
    },
    kontrabas: {
      id: 'kontrabas',
      name: 'Kontrabas',
      // E – A – D – G (zdola nahor), ladenie v kvartách
      strings: [
        { name: 'E', pc: 4 },
        { name: 'A', pc: 9 },
        { name: 'D', pc: 2 },
        { name: 'G', pc: 7 }
      ]
    }
  };

  // 1. poloha: poltónová vzdialenosť od prázdnej struny -> prst.
  // 0 = prázdna struna, 4 = malíček (alebo prázdna vyššia struna).
  const FINGER = [0, 1, 1, 2, 2, 3, 3, 4];
  const MAX_SEMITONE = 7;

  // Pre dané tóny akordu vráti všetky hmaty v 1. polohe na danom nástroji.
  function placementsForChord(instrumentId, notes) {
    const inst = INSTRUMENTS[instrumentId];
    const out = [];
    inst.strings.forEach(function (str, si) {
      notes.forEach(function (note) {
        const d = ((note.pc - str.pc) % 12 + 12) % 12;
        if (d <= MAX_SEMITONE) {
          out.push({
            stringIndex: si,
            stringName: str.name,
            semis: d,
            finger: FINGER[d],
            isOpen: d === 0,
            note: note.name,
            pc: note.pc,
            role: note.role
          });
        }
      });
    });
    return out;
  }

  // Umiestni jeden tón (pitch class) na konkrétnu strunu v 1. polohe.
  // Vráti hmat alebo null, ak je tón mimo dosahu (> MAX_SEMITONE).
  function placeOn(instrumentId, stringIndex, notePc) {
    const inst = INSTRUMENTS[instrumentId];
    const str = inst.strings[stringIndex];
    if (!str) return null;
    const d = ((notePc - str.pc) % 12 + 12) % 12;
    if (d > MAX_SEMITONE) return null;
    return {
      stringIndex: stringIndex,
      stringName: str.name,
      semis: d,
      finger: FINGER[d],
      isOpen: d === 0,
      pc: notePc
    };
  }

  global.Instruments = {
    INSTRUMENTS: INSTRUMENTS,
    MAX_SEMITONE: MAX_SEMITONE,
    placementsForChord: placementsForChord,
    placeOn: placeOn
  };
})(window);

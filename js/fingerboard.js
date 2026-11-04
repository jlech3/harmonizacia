// fingerboard.js — vykreslenie hmatníka v SVG s vyznačenými tónmi akordu.
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  // Farby podľa role tónu v akorde (zhodné s legendou v UI).
  const ROLE_COLORS = {
    'Základný tón': '#b81d24', // červená niť
    'Tercia': '#2f6d39',       // zelená niť
    'Kvinta': '#2b4b7e',       // modrá niť
    'Zmenšená kvinta': '#2b4b7e',
    'Septima': '#d49a1f',      // zlatá niť
    'Stupeň': '#b81d24'
  };

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // Vytvorí <svg> hmatníka pre nástroj a zoznam hmatov (placements).
  function render(instrumentId, placements) {
    const inst = global.Instruments.INSTRUMENTS[instrumentId];
    const strings = inst.strings;
    const n = strings.length;
    const maxS = global.Instruments.MAX_SEMITONE;

    const padL = 60, padR = 28, padT = 26, padB = 28;
    const colW = 48, rowH = 50;
    const w = padL + maxS * colW + padR;
    const h = padT + (n - 1) * rowH + padB;

    const svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, class: 'fb' });
    svg.setAttribute('width', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // index 0 = najhrubšia struna -> dole; najvyššia struna -> hore
    const sy = function (i) { return padT + (n - 1 - i) * rowH; };
    const sx = function (s) { return padL + s * colW; };
    const top = padT - 8, bot = padT + (n - 1) * rowH + 8;

    // Poltónové vodiace čiary. Pri husliach a viole zvýrazníme stĺpce základného
    // durového hmatu: 1.–4. prst = 2, 4, 5, 7 poltónov od prázdnej struny
    // (2. a 3. prst sú pri sebe — poltón medzi nimi).
    const majorFrame = (instrumentId === 'husle' || instrumentId === 'viola');
    const MAJOR_FRAME_SEMIS = [2, 4, 5, 7];
    for (let s = 1; s <= maxS; s++) {
      const cls = (majorFrame && MAJOR_FRAME_SEMIS.indexOf(s) !== -1)
        ? 'fb-grid fb-grid-major' : 'fb-grid';
      svg.appendChild(el('line', { x1: sx(s), y1: top, x2: sx(s), y2: bot, class: cls }));
    }

    // Struny + popisky prázdnych strún.
    strings.forEach(function (str, i) {
      const y = sy(i);
      svg.appendChild(el('line', { x1: padL, y1: y, x2: sx(maxS), y2: y, class: 'fb-string' }));
      const lbl = el('text', { x: padL - 26, y: y + 4, class: 'fb-strlabel' });
      lbl.textContent = str.name;
      svg.appendChild(lbl);
    });

    // Pražcová čiara (nut) vľavo.
    svg.appendChild(el('line', { x1: padL, y1: top, x2: padL, y2: bot, class: 'fb-nut' }));

    // Hmaty.
    placements.forEach(function (p) {
      const y = sy(p.stringIndex);
      const x = sx(p.semis);
      const color = ROLE_COLORS[p.role] || '#666';
      const g = el('g', {});

      // Spoločný (držaný) tón v kontra linke — tyrkysový prerušovaný krúžok.
      if (p.held) {
        g.appendChild(el('circle', {
          cx: x, cy: y, r: 24, fill: 'none', stroke: '#1b9e9e',
          'stroke-width': 2.5, 'stroke-dasharray': '2 3'
        }));
      }

      // Septima (do harmónie ju prináša kontra) — zvýraznená dvojitým krúžkom.
      if (p.role === 'Septima') {
        g.appendChild(el('circle', {
          cx: x, cy: y, r: 20, fill: 'none', stroke: color, 'stroke-width': 2.5
        }));
      }

      const c = el('circle', { cx: x, cy: y, r: 15 });
      if (p.isOpen) {
        c.setAttribute('fill', '#fff');
        c.setAttribute('stroke', color);
        c.setAttribute('stroke-width', 3);
      } else {
        c.setAttribute('fill', color);
        c.setAttribute('stroke', '#fff');
        c.setAttribute('stroke-width', 2);
      }
      g.appendChild(c);

      const nm = el('text', { x: x, y: y + 4, class: 'fb-note' });
      nm.textContent = p.note;
      nm.setAttribute('fill', p.isOpen ? color : '#fff');
      g.appendChild(nm);

      // Odznak s číslom prsta (0 = prázdna struna).
      const bx = x + 14, by = y - 14;
      g.appendChild(el('circle', { cx: bx, cy: by, r: 9, fill: '#2b2b33', stroke: '#fff', 'stroke-width': 1.5 }));
      const bt = el('text', { x: bx, y: by + 3, class: 'fb-finger' });
      bt.textContent = p.finger;
      g.appendChild(bt);

      svg.appendChild(g);
    });

    return svg;
  }

  global.Fingerboard = {
    ROLE_COLORS: ROLE_COLORS,
    render: render
  };
})(window);

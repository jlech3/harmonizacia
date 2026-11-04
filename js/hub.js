// hub.js — Hlavná stránka: živý náhľad hmatníka + mini zoznam piesní.
(function () {
  'use strict';

  function keyDisplay(id) {
    const k = window.Theory && Theory.getKey ? Theory.getKey(id) : null;
    return k ? k.display : (id || '').replace('-', ' ');
  }

  // Živý náhľad: jeden kontra dvojhmat akordu a-mol na viole.
  function renderHeroBoard() {
    const host = document.getElementById('heroBoard');
    if (!host || !window.Theory || !window.Kontra || !window.Fingerboard) return;
    const chord = Theory.parseChord('a');
    if (!chord) return;
    const cands = Kontra.candidates(chord, 'viola');
    if (!cands.length) return;
    host.innerHTML = '';
    host.appendChild(Fingerboard.render('viola', cands[0].notes));
  }

  // Mini zoznam: posledné 3 piesne.
  function renderSongs() {
    const host = document.getElementById('heroSongs');
    if (!host || !window.Store) return;
    const songs = Store.list().slice(0, 3);
    host.innerHTML = '';
    if (!songs.length) {
      const p = document.createElement('p');
      p.className = 'tile-desc';
      p.textContent = 'Zatiaľ žiadne piesne — vytvor prvú.';
      host.appendChild(p);
      return;
    }
    songs.forEach(function (s) {
      const a = document.createElement('a');
      a.href = 'piesen.html?id=' + encodeURIComponent(s.id);
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = s.title || 'Bez názvu';
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = keyDisplay(s.key) + ' · ' + (s.tempo || '–');
      a.appendChild(nm);
      a.appendChild(meta);
      // klik na riadok nesmie preskočiť na knižnicu (dlaždica je tiež odkaz)
      a.addEventListener('click', function (e) { e.stopPropagation(); });
      host.appendChild(a);
    });
  }

  renderHeroBoard();
  renderSongs();
})();

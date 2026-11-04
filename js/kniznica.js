// kniznica.js — zoznam piesní: vykreslenie, hľadanie, filter, mazanie.
(function () {
  'use strict';

  const DIFF = {
    zaciatocnik: { label: 'Začiatočník', cls: 'teal' },
    mierne: { label: 'Mierne pokročilý', cls: 'amber' },
    pokrocily: { label: 'Pokročilý', cls: 'coral' }
  };

  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  const countEl = document.getElementById('libCount');
  const searchEl = document.getElementById('search');
  const filtersEl = document.getElementById('filters');

  const state = { q: '', diff: 'all' };

  function keyDisplay(id) {
    const k = window.Theory && Theory.getKey ? Theory.getKey(id) : null;
    return k ? k.display : (id || '').replace('-', ' ');
  }

  const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>';

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function card(song) {
    const c = el('article', 'song-card');

    const top = el('div', 'sc-top');
    top.appendChild(pill(keyDisplay(song.key), 'mono'));
    const d = DIFF[song.difficulty];
    if (d) top.appendChild(pill(d.label, d.cls));
    c.appendChild(top);

    const h = el('h3');
    const link = el('a', null, song.title || 'Bez názvu');
    link.href = 'piesen.html?id=' + encodeURIComponent(song.id);
    h.appendChild(link);
    c.appendChild(h);

    c.appendChild(el('p', 'genre', song.style || '—'));

    const foot = el('div', 'sc-foot');
    foot.appendChild(el('span', 'bpm', (song.tempo || '–') + ' BPM'));
    const actions = el('div');
    actions.style.cssText = 'display:flex;gap:8px;align-items:center';
    const del = el('button', 'sc-del');
    del.type = 'button';
    del.title = 'Zmazať pieseň';
    del.setAttribute('aria-label', 'Zmazať pieseň');
    del.innerHTML = ICON_TRASH;
    del.addEventListener('click', function () {
      if (confirm('Zmazať pieseň „' + (song.title || 'Bez názvu') + '"? Nedá sa vrátiť.')) {
        Store.remove(song.id);
        render();
      }
    });
    const play = el('a', 'sc-play');
    play.href = 'piesen.html?id=' + encodeURIComponent(song.id);
    play.setAttribute('aria-label', 'Otvoriť a prehrať');
    play.innerHTML = ICON_PLAY;
    actions.appendChild(del);
    actions.appendChild(play);
    foot.appendChild(actions);
    c.appendChild(foot);
    return c;
  }

  function pill(text, cls) {
    const p = el('span', 'pill' + (cls ? ' ' + cls : ''), text);
    return p;
  }

  function matches(song) {
    if (state.diff !== 'all' && song.difficulty !== state.diff) return false;
    if (!state.q) return true;
    const hay = [song.title, song.style, song.region, keyDisplay(song.key)].join(' ').toLowerCase();
    return hay.indexOf(state.q) !== -1;
  }

  function render() {
    const all = Store.list();
    const shown = all.filter(matches);
    countEl.textContent = all.length + (all.length === 1 ? ' pieseň' : (all.length < 5 ? ' piesne' : ' piesní'));
    grid.innerHTML = '';
    shown.forEach(function (s) { grid.appendChild(card(s)); });
    empty.hidden = shown.length > 0;
  }

  searchEl.addEventListener('input', function () {
    state.q = searchEl.value.trim().toLowerCase();
    render();
  });
  filtersEl.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-f]');
    if (!btn) return;
    state.diff = btn.getAttribute('data-f');
    filtersEl.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    render();
  });

  render();
})();

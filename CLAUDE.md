# Harmonizácia — webová aplikácia na učenie harmonizácie slovenských ľudových piesní

## Používateľ a spôsob práce
- **Vždy odpovedaj po slovensky.**
- Používateľ je ľudový muzikant (hrá kontru na viole/husliach) a študent informatiky.
  Aplikácia sa týka **len ľudovej hudby** a musí byť čo najpresnejšia — nesmie „znieť zle".
- **Na otázku len vysvetli a počkaj.** Kód meň až na výslovný pokyn (aj keď otázka
  naznačuje chybu). Keď si nie si istý, opýtaj sa.
- **Commit a push len na požiadanie.** Commit správy po slovensky (bez diakritiky v prvom
  riadku je OK), na konci `Co-Authored-By: ...` podľa pokynov nástroja.
- Nič nesťahuj z internetu bez súhlasu (uveď zdroj, názov a veľkosť).
- Zvuk nepočuješ — keď ide o zvuk, over aspoň meraním (časovanie, hlasitosť) a nechaj
  posúdenie na používateľovi. Neladiť zvuk naslepo v mnohých iteráciách.

## Spustenie
Čisté HTML + JavaScript, **bez buildu a bez závislostí** (Tone.js 14.8.49 je v `js/lib/Tone.js`).
```bash
python -m http.server 8000
```
Potom http://127.0.0.1:8000/ (index), knižnica `kniznica.html`. Po zmene JS/CSS treba v prehliadači
**Ctrl+Shift+R** (inak beží stará verzia z cache).

## Štruktúra
| Súbor | Čo robí |
|---|---|
| `index.html` + `js/hub.js` | rozcestník (náhľad hmatníka, posledné piesne) |
| `kniznica.html` + `js/kniznica.js` | zoznam piesní, hľadanie, filter, mazanie |
| `editor.html` + `js/editor.js` | tvorba/úprava piesne: políčka po dobách, paleta akordov, výber úseku, nastavenia spodkov |
| `piesen.html` + `js/piesen.js` | zobrazenie piesne: hmaty basy/kontry ku každému akordu, prehrávanie, rola (basista/kontráš), nástroj (viola/husle) |
| `kontras.html`, `basista.html`, `akordy.html` + `js/app.js` | starší tréneri (vlastný vzhľad v `styles.css`, prehrávajú cez `playProgression`) |
| `js/store.js` | `Store`: piesne v localStorage (`harmonizacia.songs.v1`), štýly spodkov, prízvuky, dĺžky |
| `js/audio.js` | `Sound`: zvuk (Tone.Sampler) a rytmické modely spodkov (`STYLES`, `playSlots`) |
| `js/theory.js` | `Theory`: tóniny, akordy (`parseChord`), funkcie T/S/D |
| `js/instruments.js`, `js/fingerboard.js` | ladenie nástrojov, hmaty v 1. polohe, kreslenie hmatníka |
| `js/kontra.js` | `Kontra.computeLine`: dvojhmaty kontry s minimálnym pohybom |
| `js/bass.js` | `Bass.computeLine`: basová linka (základný tón, pri X7 tercia), minimálny posun ruky |
| `app.css` | dizajn novej aplikácie (tmavý); `styles.css` patrí starým trénerom |

Moduly sú IIFE a vystavujú globály (`Theory`, `Instruments`, `Fingerboard`, `Kontra`, `Bass`,
`Sound`, `Store`). Globál zvuku sa **nesmie** volať `Audio` (koliduje s prehliadačom).

## Dátový model piesne
```js
{ id, title, key: 'a-mol', tempo: 100, timeSig: '2/4',
  accomp: 'estam'|'duvaj8'|'duvaj4'|'stvrte'|'osminy'|'valcik',
  artic: 'auto'|'staccato'|'tenuto'|'presah', accent: '1212'|'2222'|'2121'|'', lengths: 'kdxx'|'xxxx'|'',
  style, region, difficulty, videoUrl, bars: [{ chords: ['a', ''] }], createdAt, updatedAt }
```
- **Jedno políčko = jedna doba.** Počet políčok v takte: 2/4→2, 3/4→3, 4/4→4, 6/8→2.
- Prázdne políčko (`''`) = pokračuje predchádzajúci akord (akord v 1. políčku platí pre celý takt).
- `Store.slotChords(song, from, to)` = akord pre každú dobu (null pred prvým akordom).
- Piesne sú len v prehliadači (localStorage) — **neprenášajú sa cez git** ani medzi počítačmi.

## Spodky (rytmický sprievod) — podľa štúdie
Zdroj: J. Ambrózová, *Analýza rytmického sprievodu v ľudových hudbách na Slovensku*,
Musicologica Slovaca 2011 (príklady 1 a 2, prílohy B a C; D. Holý). Implementácia v `audio.js` (`STYLES`).
- **Es-tam (esta):** basa na dobu, kontra na ľahkú osminu medzi dobami. Artikulácia podľa
  tempa (`Store.resolveArtic`): <100 BPM presah, 100–169 staccato, ≥170 tenuto.
- **Osminový duvaj (V8):** basa a kontra hrajú spolu. Variant A = (1'2)(3'4): dve osminy
  v jednom ťahu, za nepárnou osminou pozastavenie sláčika, párna znie až po ďalšiu.
  Prízvuky 1212 (východiskový) / 2222 / 2121 (ťah 1)'(23)'(4). Dĺžky `kdxx`: v miernom tempe
  prvá osmina kratšia (~37:63 pri 100 BPM, s tempom sa vyrovnáva do 160 BPM), druhé
  poltaktie súmerné, poltaktia 12:13. `xxxx` = všetko rovnako.
- **Štvrťový duvaj (V4, „čardáš"):** štvrte viazané po dvoch (12)(34), prízvuk 2222 alebo 1212.
- Ďalej: štvrte neviazané, osminy neviazané, valčík (3/4).
- Sila prízvuku (`LEVEL` v audio.js): 0 = 0.3, 1 = 0.55, 2 = 0.95, 3 = 1.0.
- Pri spodkoch má sampler krátke doznievanie (`REL_SLOTS`), aby boli počuť dĺžky a pauzy;
  tréneri majú dlhé (`REL_TRAINER`).

## Zvuk — stav a história
- Aktuálne: pôvodné nahrávky `samples/viola` a `samples/contrabass` cez `Tone.Sampler`;
  kontra znie ako celý dvojhmat (akord), basa jeden tón v 2. oktáve.
- **Zamietnuté** (znelo zle / falošne / nie ako viola): University of Iowa MIS samply a
  Philharmonia samply (aj s obálkou ťahu podľa krivky Holého — duvaj potom znel ako esta).
  Priečinky `samples/iowa`, `samples/ph` nie sú v gite a aplikácia ich nepoužíva.
- **Plán:** vlastné nahrávky používateľa (viola, prípadne basa) — súvislá hra s metronómom
  v slúchadlách, každý dvojhmat v štýloch esta / duvaj / čardáš v 2 tempách, WAV, A=440.
  Začať skúšobne len D dur a A7.

## Ďalšie plány (zatiaľ nerobiť bez pokynu)
- basová linka s prechodovými tónmi (stupnica, chromatika), kontra s plynulým vedením hlasov;
- export/import všetkých piesní v UI, nahrávanie audia (Fáza 2);
- prerobiť staré trénery do nového tmavého dizajnu;
- názov aplikácie.

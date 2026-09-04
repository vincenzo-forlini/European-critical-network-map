/**
 * The periodic table view: which chemical elements the EU treats as critical.
 *
 * The mapping is not one-to-one, and pretending otherwise would misrepresent the
 * list. Three complications, all handled explicitly rather than smoothed over:
 *
 *  - Some critical raw materials are GROUPS. "Platinum group metals" is six
 *    elements; "light" and "heavy rare earths" are seven and nine. Every member
 *    cell links to the same factsheet.
 *  - Some are MINERALS, not elements: baryte, fluorspar, phosphate rock and
 *    feldspar. They sit on their own row beneath the table. Putting baryte on
 *    barium would say the listed material is the metal, which it is not.
 *  - One cell carries TWO materials: carbon is both natural graphite and coking
 *    coal. It opens both factsheets, one after the other, rather than picking.
 */

import { esc } from './ui.js';

/* Z | symbol | name | column (1-18) | row (1-7, then 9 lanthanides, 10 actinides) */
const TABLE = `
1|H|Hydrogen|1|1
2|He|Helium|18|1
3|Li|Lithium|1|2
4|Be|Beryllium|2|2
5|B|Boron|13|2
6|C|Carbon|14|2
7|N|Nitrogen|15|2
8|O|Oxygen|16|2
9|F|Fluorine|17|2
10|Ne|Neon|18|2
11|Na|Sodium|1|3
12|Mg|Magnesium|2|3
13|Al|Aluminium|13|3
14|Si|Silicon|14|3
15|P|Phosphorus|15|3
16|S|Sulfur|16|3
17|Cl|Chlorine|17|3
18|Ar|Argon|18|3
19|K|Potassium|1|4
20|Ca|Calcium|2|4
21|Sc|Scandium|3|4
22|Ti|Titanium|4|4
23|V|Vanadium|5|4
24|Cr|Chromium|6|4
25|Mn|Manganese|7|4
26|Fe|Iron|8|4
27|Co|Cobalt|9|4
28|Ni|Nickel|10|4
29|Cu|Copper|11|4
30|Zn|Zinc|12|4
31|Ga|Gallium|13|4
32|Ge|Germanium|14|4
33|As|Arsenic|15|4
34|Se|Selenium|16|4
35|Br|Bromine|17|4
36|Kr|Krypton|18|4
37|Rb|Rubidium|1|5
38|Sr|Strontium|2|5
39|Y|Yttrium|3|5
40|Zr|Zirconium|4|5
41|Nb|Niobium|5|5
42|Mo|Molybdenum|6|5
43|Tc|Technetium|7|5
44|Ru|Ruthenium|8|5
45|Rh|Rhodium|9|5
46|Pd|Palladium|10|5
47|Ag|Silver|11|5
48|Cd|Cadmium|12|5
49|In|Indium|13|5
50|Sn|Tin|14|5
51|Sb|Antimony|15|5
52|Te|Tellurium|16|5
53|I|Iodine|17|5
54|Xe|Xenon|18|5
55|Cs|Caesium|1|6
56|Ba|Barium|2|6
72|Hf|Hafnium|4|6
73|Ta|Tantalum|5|6
74|W|Tungsten|6|6
75|Re|Rhenium|7|6
76|Os|Osmium|8|6
77|Ir|Iridium|9|6
78|Pt|Platinum|10|6
79|Au|Gold|11|6
80|Hg|Mercury|12|6
81|Tl|Thallium|13|6
82|Pb|Lead|14|6
83|Bi|Bismuth|15|6
84|Po|Polonium|16|6
85|At|Astatine|17|6
86|Rn|Radon|18|6
87|Fr|Francium|1|7
88|Ra|Radium|2|7
104|Rf|Rutherfordium|4|7
105|Db|Dubnium|5|7
106|Sg|Seaborgium|6|7
107|Bh|Bohrium|7|7
108|Hs|Hassium|8|7
109|Mt|Meitnerium|9|7
110|Ds|Darmstadtium|10|7
111|Rg|Roentgenium|11|7
112|Cn|Copernicium|12|7
113|Nh|Nihonium|13|7
114|Fl|Flerovium|14|7
115|Mc|Moscovium|15|7
116|Lv|Livermorium|16|7
117|Ts|Tennessine|17|7
118|Og|Oganesson|18|7
57|La|Lanthanum|3|9
58|Ce|Cerium|4|9
59|Pr|Praseodymium|5|9
60|Nd|Neodymium|6|9
61|Pm|Promethium|7|9
62|Sm|Samarium|8|9
63|Eu|Europium|9|9
64|Gd|Gadolinium|10|9
65|Tb|Terbium|11|9
66|Dy|Dysprosium|12|9
67|Ho|Holmium|13|9
68|Er|Erbium|14|9
69|Tm|Thulium|15|9
70|Yb|Ytterbium|16|9
71|Lu|Lutetium|17|9
89|Ac|Actinium|3|10
90|Th|Thorium|4|10
91|Pa|Protactinium|5|10
92|U|Uranium|6|10
93|Np|Neptunium|7|10
94|Pu|Plutonium|8|10
95|Am|Americium|9|10
96|Cm|Curium|10|10
97|Bk|Berkelium|11|10
98|Cf|Californium|12|10
99|Es|Einsteinium|13|10
100|Fm|Fermium|14|10
101|Md|Mendelevium|15|10
102|No|Nobelium|16|10
103|Lr|Lawrencium|17|10
`.trim().split('\n').map((line) => {
  const [z, symbol, name, col, row] = line.split('|');
  return { z: +z, symbol, name, col: +col, row: +row };
});

/**
 * Chemical symbol -> critical raw material id, plus a note where the element is
 * standing in for a mineral or heading a group.
 */
const SYMBOL_TO_CRM = {
  Al: [['aluminium', 'as bauxite and alumina']],
  Sb: [['antimony']],
  As: [['arsenic']],
  Be: [['beryllium']],
  Bi: [['bismuth']],
  B: [['boron', 'as borates']],
  Co: [['cobalt']],
  C: [['natural-graphite'], ['coking-coal']],
  Cu: [['copper']],
  Ga: [['gallium']],
  Ge: [['germanium']],
  Hf: [['hafnium']],
  He: [['helium']],
  Li: [['lithium']],
  Mg: [['magnesium']],
  Mn: [['manganese']],
  Ni: [['nickel']],
  Nb: [['niobium']],
  P: [['phosphorus', 'elemental white phosphorus']],
  Sc: [['scandium']],
  Si: [['silicon-metal']],
  Sr: [['strontium', 'as celestite']],
  Ta: [['tantalum']],
  Ti: [['titanium-metal']],
  W: [['tungsten']],
  V: [['vanadium']],
};

// Groups: every member cell points at the one group factsheet.
const GROUPS = {
  pgm: { symbols: ['Ru', 'Rh', 'Pd', 'Os', 'Ir', 'Pt'], note: 'one of the platinum group metals' },
  'light-rare-earths': { symbols: ['La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu'], note: 'a light rare earth element' },
  'heavy-rare-earths': { symbols: ['Y', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu'], note: 'a heavy rare earth element' },
};
for (const [id, { symbols, note }] of Object.entries(GROUPS)) {
  for (const s of symbols) (SYMBOL_TO_CRM[s] ??= []).push([id, note]);
}

/**
 * Materials that are minerals or commodities rather than chemical elements.
 * They get their own row beneath the table: putting baryte on barium implies the
 * listed material is the metal, which it is not.
 */
const NOT_ELEMENTS = ['baryte', 'fluorspar', 'phosphate-rock', 'feldspar'];

/* --------------------------------------------------------------- rendering */

export function renderPeriodicTable(container, model) {
  const cells = TABLE.map((el) => {
    const entries = (SYMBOL_TO_CRM[el.symbol] || [])
      .map(([id, note]) => ({ el: model.elementById.get(id), note }))
      .filter((e) => e.el);

    if (entries.length === 0) {
      return `<div class="pt-cell" style="grid-column:${el.col};grid-row:${el.row}">
        <span class="pt-z">${el.z}</span>
        <span class="pt-sym">${el.symbol}</span>
        <span class="pt-name">${esc(el.name)}</span>
      </div>`;
    }

    const strategic = entries.some((e) => e.el.strategic);
    const sites = entries.reduce((n, e) => n + e.el.facility_count, 0);
    const title = entries
      .map((e) => e.el.name + (e.note ? ` — ${e.note}` : ''))
      .join(' / ');

    // A cell carrying two materials opens both factsheets, one after the other.
    const act = `data-act="open-element" data-id="${esc(entries.map((e) => e.el.id).join(','))}"`;

    return `<button class="pt-cell pt-cell--crm${strategic ? ' pt-cell--strategic' : ''}"
      style="grid-column:${el.col};grid-row:${el.row}" ${act}
      title="${esc(el.name)} — ${esc(title)}">
      <span class="pt-z">${el.z}</span>
      <span class="pt-sym">${el.symbol}</span>
      <span class="pt-name">${esc(entries.map((e) => e.el.name).join(" / "))}</span>
      ${sites > 0 ? `<span class="pt-sites" title="${sites} European site(s)">${sites}</span>` : ''}
    </button>`;
  }).join('');

  // Row labels for the two detached blocks.
  const marks = `
    <div class="pt-cell pt-cell--ghost" style="grid-column:3;grid-row:6">57–71</div>
    <div class="pt-cell pt-cell--ghost" style="grid-column:3;grid-row:7">89–103</div>`;

  const orphans = NOT_ELEMENTS
    .map((id) => model.elementById.get(id))
    .filter(Boolean)
    .map(
      (e) => `<button class="chip chip--el-link" data-act="open-element" data-id="${esc(e.id)}">
        ${esc(e.name)}${e.strategic ? ' &#9733;' : ''}
      </button>`
    )
    .join('');

  const total = model.elements.length;
  const strategicRows = model.elements.filter((e) => e.strategic).length;

  container.innerHTML = `
    <p class="pt-lede">
      The ${total} critical raw materials of the EU Critical Raw Materials Act, 17 of which the
      Act designates as strategic. Click any highlighted element to open its factsheet. The small
      number in a corner is how many European sites in this dataset handle it.
      ${strategicRows === 18
        ? `<br><span class="faint">The Act's 17 strategic materials appear here as 18 rows: it
           treats rare earths for magnets as one entry, while this dataset keeps light and heavy
           rare earths apart, and both contain magnet elements.</span>`
        : ''}
    </p>

    <div class="pt-legend">
      <span class="pt-key pt-key--strategic">Strategic raw material</span>
      <span class="pt-key pt-key--crm">Critical raw material</span>
      <span class="pt-key">Not listed</span>
    </div>

    <div class="pt-grid">${cells}${marks}</div>

    <div class="pt-orphans">
      <span class="pt-orphans__label">Not chemical elements</span>
      <div class="pt-orphans__list">${orphans}</div>
    </div>

    <p class="pt-foot">
      Baryte, fluorspar and phosphate rock are minerals, and feldspar is a family of
      aluminosilicates — none of them is the element it contains, so none sits on the table.
      Platinum group metals and the two rare earth groups are highlighted across every member,
      and each member opens the same group factsheet. Carbon carries two listed materials,
      natural graphite and coking coal, and opens both.
    </p>`;
}

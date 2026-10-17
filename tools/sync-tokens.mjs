// Synchronizes the 8 Paul Tol qualitative schemes + canonical achromatic stops
// from ../tol-palettes/data/schemes/*.json (when available locally) into
// data/tol-qualitative.json and generates src/tokens.css + src/palettes.css.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const upstreamDir = join(root, '..', 'tol-palettes', 'data', 'schemes');
const snapshotPath = join(root, 'data', 'tol-qualitative.json');
const tokensCssPath = join(root, 'src', 'tokens.css');
const palettesCssPath = join(root, 'src', 'palettes.css');

const QUALITATIVE_IDS = [
  'bright',
  'dark',
  'high-contrast',
  'light',
  'medium-contrast',
  'muted',
  'pale',
  'prgn',
  'vibrant',
];

const SCHEME_PREFIX = {
  'bright': 'bright',
  'dark': 'dark',
  'high-contrast': 'hc',
  'light': 'light',
  'medium-contrast': 'mc',
  'muted': 'muted',
  'pale': 'pale',
  'prgn': 'prgn',
  'vibrant': 'vibrant',
};

const ACHROMATIC_SOURCES = [
  { name: 'white', scheme: 'sunset', field: 'bad' }, // #FFFFFF
  { name: 'grey-200', scheme: 'pale', index: 6 }, // #DDDDDD
  { name: 'grey-300', scheme: 'bright', index: 6 }, // #BBBBBB
  { name: 'grey-400', scheme: 'iridescent', field: 'bad' }, // #999999
  { name: 'grey-500', scheme: 'ylorbr', field: 'bad' }, // #888888
  { name: 'grey-600', scheme: 'rainbow-discrete', lutBad: '23' }, // #777777
  { name: 'grey-700', scheme: 'rainbow-smooth', field: 'bad' }, // #666666
  { name: 'grey-800', scheme: 'dark', index: 10 }, // #444444
  { name: 'black', scheme: 'bright', extra: 'black' }, // #000000
];

export function loadSnapshot() {
  if (existsSync(upstreamDir)) {
    const schemes = {};
    const allowedHexSet = new Set();

    for (const id of QUALITATIVE_IDS) {
      const raw = JSON.parse(readFileSync(join(upstreamDir, `${id}.json`), 'utf8'));
      const colors = id === 'prgn' ? raw.colors.slice(0, 4) : raw.colors;
      schemes[id] = {
        id: raw.id,
        kind: raw.kind,
        colors,
        ...(raw.extras ? { extras: raw.extras } : {}),
        ...(raw.bad ? { bad: raw.bad } : {}),
      };
      for (const c of colors) allowedHexSet.add(c.hex.toUpperCase());
      for (const c of raw.extras ?? []) allowedHexSet.add(c.hex.toUpperCase());
      if (raw.bad) allowedHexSet.add(raw.bad.toUpperCase());
    }

    const achromatic = [];
    for (const item of ACHROMATIC_SOURCES) {
      const raw = JSON.parse(readFileSync(join(upstreamDir, `${item.scheme}.json`), 'utf8'));
      let hex;
      if (item.field === 'bad') hex = raw.bad;
      else if (typeof item.index === 'number') hex = raw.colors[item.index].hex;
      else if (item.lutBad) hex = raw.lutBad[item.lutBad];
      else if (item.extra) hex = raw.extras.find((e) => e.name === item.extra).hex;
      allowedHexSet.add(hex.toUpperCase());
      achromatic.push({
        name: item.name,
        hex,
        sourceScheme: item.scheme,
      });
    }

    const snapshot = {
      schemes,
      achromatic,
      allowedHexes: [...allowedHexSet].sort(),
    };
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
    return snapshot;
  }

  if (!existsSync(snapshotPath)) {
    throw new Error(`Neither upstream ${upstreamDir} nor ${snapshotPath} exists.`);
  }
  return JSON.parse(readFileSync(snapshotPath, 'utf8'));
}

export function buildTokensCss(snapshot = loadSnapshot()) {
  const s = snapshot.schemes;
  const ach = Object.fromEntries(snapshot.achromatic.map((a) => [a.name, a.hex]));
  const colorByName = (schemeId, nameOrIndex) => {
    const list = s[schemeId].colors;
    if (typeof nameOrIndex === 'number') return list[nameOrIndex].hex;
    return list.find((c) => c.name === nameOrIndex).hex;
  };

  const lines = [
    '@layer tokens, base, layout, content, forms, nav, components;',
    '@layer tokens {',
    '  :root, :host, [data-accent="blue"] {',
    '    color-scheme: light dark;',
    '    --tc-font-sans: system-ui, sans-serif;',
    '    --tc-font-mono: ui-monospace, monospace;',
    '    --tc-line-height: 1.5;',
    '    --tc-border-radius: 0.25rem;',
    '    --tc-transition: 0.15s ease-in-out;',
    '    --tc-spacing: 1rem;',
    '    --tc-form-y: 0.5rem;',
    '    --tc-form-x: 0.75rem;',
    '    --tc-container-max: 70rem;',
    '    --tc-grid-min: 15rem;',
    `    --tc-bg: light-dark(${ach['white']}, ${ach['black']});`,
    `    --tc-surface: light-dark(${ach['grey-200']}, ${ach['grey-800']});`,
    '    --tc-surface-subtle: color-mix(in srgb, var(--tc-surface) 38%, transparent);',
    `    --tc-color: light-dark(${ach['black']}, ${ach['white']});`,
    `    --tc-muted-color: light-dark(${ach['grey-800']}, ${ach['grey-200']});`,
    `    --tc-muted-border: light-dark(${ach['grey-300']}, ${ach['grey-700']});`,
    '    --tc-border: 1px solid var(--tc-muted-border);',
    `    --tc-valid: light-dark(${colorByName('dark', 5)}, ${colorByName('light', 'mint')});`,
    `    --tc-invalid: light-dark(${colorByName('vibrant', 'red')}, ${colorByName('bright', 'red')});`,
    `    --tc-mark-bg: light-dark(${colorByName('pale', 3)}, ${colorByName('dark', 9)});`,
    '    --tc-box-shadow: 0 2px 8px color-mix(in srgb, var(--tc-color) 12%, transparent);',
    `    --tc-p1: ${colorByName('pale', 0)}; --tc-p2: ${colorByName('light', 'light_blue')}; --tc-p3: ${colorByName('bright', 'blue')}; --tc-p4: ${colorByName('dark', 3)}; --tc-p5: ${colorByName('high-contrast', 'blue')};`,
    '  }',
    '  :root, :host, :where([data-accent], [data-theme]) {',
    '    --tc-primary: light-dark(var(--tc-p4), var(--tc-p2));',
    '    --tc-primary-hover: light-dark(var(--tc-p5), var(--tc-p1));',
    '    --tc-primary-bg: light-dark(var(--tc-p1), var(--tc-p4));',
    '    --tc-primary-hover-bg: light-dark(var(--tc-p2), var(--tc-p3));',
    '  }',
    '  [data-theme="light"] { color-scheme: light; }',
    '  [data-theme="dark"] { color-scheme: dark; }',
    '  [data-accent="cyan"] {',
    `    --tc-p1: ${colorByName('pale', 1)}; --tc-p2: ${colorByName('light', 'light_cyan')}; --tc-p3: ${colorByName('muted', 'teal')}; --tc-p4: ${colorByName('dark', 6)}; --tc-p5: ${colorByName('dark', 5)};`,
    '  }',
    '  [data-accent="green"] {',
    `    --tc-p1: ${colorByName('pale', 2)}; --tc-p2: ${colorByName('light', 'mint')}; --tc-p3: ${colorByName('bright', 'green')}; --tc-p4: ${colorByName('dark', 5)}; --tc-p5: ${colorByName('muted', 'green')};`,
    '  }',
    '  [data-accent="yellow"] {',
    `    --tc-p1: ${colorByName('pale', 3)}; --tc-p2: ${colorByName('high-contrast', 'yellow')}; --tc-p3: ${colorByName('medium-contrast', 'dark_yellow')}; --tc-p4: ${colorByName('dark', 9)}; --tc-p5: ${colorByName('medium-contrast', 'dark_yellow')};`,
    '  }',
    '  [data-accent="red"] {',
    `    --tc-p1: ${colorByName('light', 'orange')}; --tc-p2: ${colorByName('bright', 'red')}; --tc-p3: ${colorByName('dark', 1)}; --tc-p4: ${colorByName('vibrant', 'red')}; --tc-p5: ${colorByName('medium-contrast', 'dark_red')};`,
    '  }',
    '  [data-accent="purple"] {',
    `    --tc-p1: ${colorByName('prgn', 3)}; --tc-p2: ${colorByName('prgn', 2)}; --tc-p3: ${colorByName('prgn', 1)}; --tc-p4: ${colorByName('prgn', 0)}; --tc-p5: ${colorByName('muted', 'indigo')};`,
    '  }',
    '}',
    '',
  ];

  return lines.join('\n');
}

export function buildPalettesCss(snapshot = loadSnapshot()) {
  const lines = [
    '@layer tokens {',
    '  :root, :host {',
  ];

  const achromaticHexes = new Set(snapshot.achromatic.map((a) => a.hex.toUpperCase()));

  for (const id of QUALITATIVE_IDS) {
    const s = snapshot.schemes[id];
    const pfx = SCHEME_PREFIX[id];
    s.colors.forEach((c, i) => {
      if (achromaticHexes.has(c.hex.toUpperCase())) return;
      const key = c.name ? c.name.replace(/^light_/, '').replace(/_/g, '-') : String(i);
      lines.push(`    --tol-${pfx}-${key}: ${c.hex};`);
    });
  }

  for (const a of snapshot.achromatic) {
    lines.push(`    --tol-${a.name}: ${a.hex};`);
  }

  lines.push(
    '    --tc-icon-chevron: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'2\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E");',
    '  }',
    '}',
    '',
  );

  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const snapshot = loadSnapshot();
  mkdirSync(dirname(tokensCssPath), { recursive: true });
  writeFileSync(tokensCssPath, buildTokensCss(snapshot), 'utf8');
  writeFileSync(palettesCssPath, buildPalettesCss(snapshot), 'utf8');
  console.log(`Synced ${Object.keys(snapshot.schemes).length} Paul Tol qualitative schemes -> src/tokens.css & src/palettes.css`);
}

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
  'ylorbr',
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
  'ylorbr': 'ylorbr',
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
      const colors =
        id === 'prgn'
          ? raw.colors.slice(0, 4)
          : id === 'ylorbr'
            ? raw.colors.slice(7, 9)
            : raw.colors;
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
    `    --pt-p1: ${colorByName('pale', 0)}; --pt-p2: ${colorByName('light', 'light_blue')}; --pt-p3: ${colorByName('bright', 'blue')}; --pt-p4: ${colorByName('dark', 3)}; --pt-p5: ${colorByName('high-contrast', 'blue')};`,
    '  }',
    '  :root, :host {',
    '    color-scheme: light dark;',
    '  }',
    '  :root, :host, :where([data-accent], [data-theme]) {',
    '    --pt-font-emoji: "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";',
    '    --pt-font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", var(--pt-font-emoji), sans-serif;',
    '    --pt-font-mono: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", var(--pt-font-emoji), monospace;',
    '    --pt-line-height: 1.5;',
    '    --pt-border-radius: 0.25rem;',
    '    --pt-transition: 0.15s ease-in-out;',
    '    --pt-spacing: 1rem;',
    '    --pt-card-padding: var(--pt-spacing);',
    '    --pt-form-y: 0.5rem;',
    '    --pt-form-x: 0.75rem;',
    '    --pt-container-max: 70rem;',
    '    --pt-grid-min: 15rem;',
    '    --pt-grid-gap: var(--pt-spacing);',
    "    --pt-icon-chevron: url(\"data:image/svg+xml,%3Csvg xmlns='http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\");",
    `    --pt-bg: light-dark(${ach['white']}, ${ach['black']});`,
    '    --pt-card-bg: var(--pt-bg);',
    `    --pt-black: ${ach['black']};`,
    `    --pt-surface: light-dark(${ach['grey-200']}, ${ach['grey-800']});`,
    '    --pt-surface-subtle: color-mix(in srgb, var(--pt-surface) 38%, transparent);',
    `    --pt-color: light-dark(${ach['black']}, ${ach['white']});`,
    `    --pt-muted-color: light-dark(${ach['grey-800']}, ${ach['grey-200']});`,
    `    --pt-muted-border: light-dark(${ach['grey-500']}, ${ach['grey-700']});`,
    '    --pt-border: 1px solid var(--pt-muted-border);',
    `    --pt-valid: light-dark(${colorByName('dark', 5)}, ${colorByName('light', 'mint')});`,
    `    --pt-warning: light-dark(${colorByName('dark', 9)}, ${colorByName('light', 'light_yellow')});`,
    `    --pt-invalid: light-dark(${colorByName('vibrant', 'red')}, ${colorByName('bright', 'red')});`,
    '    --pt-red: #EE6677;',
    '    --pt-yellow: #CCBB44;',
    '    --pt-cyan: #66CCEE;',
    `    --pt-mark-bg: light-dark(${colorByName('pale', 3)}, ${colorByName('dark', 9)});`,
    '    --pt-box-shadow: 0 2px 8px color-mix(in srgb, var(--pt-color) 12%, transparent);',
    '    --pt-primary: light-dark(var(--pt-p4), var(--pt-p2));',
    '    --pt-primary-hover: light-dark(var(--pt-p5), var(--pt-p1));',
    '    --pt-primary-bg: light-dark(var(--pt-p1), var(--pt-p4));',
    '    --pt-primary-hover-bg: light-dark(var(--pt-p2), var(--pt-p3));',
    '  }',
    '  [data-theme="light"] { color-scheme: light; }',
    '  [data-theme="dark"] { color-scheme: dark; }',
    '  [data-accent="cyan"] {',
    `    --pt-p1: ${colorByName('pale', 1)}; --pt-p2: ${colorByName('light', 'light_cyan')}; --pt-p3: ${colorByName('vibrant', 'blue')}; --pt-p4: ${colorByName('dark', 6)}; --pt-p5: ${colorByName('high-contrast', 'blue')};`,
    '  }',
    '  [data-accent="purple"] {',
    `    --pt-p1: ${colorByName('prgn', 3)}; --pt-p2: ${colorByName('prgn', 2)}; --pt-p3: ${colorByName('muted', 'purple')}; --pt-p4: ${colorByName('prgn', 0)}; --pt-p5: ${colorByName('muted', 'indigo')};`,
    '  }',
    '  [data-accent="magenta"] {',
    `    --pt-p1: ${colorByName('pale', 5)}; --pt-p2: ${colorByName('light', 'pink')}; --pt-p3: ${colorByName('dark', 8)}; --pt-p4: ${colorByName('dark', 4)}; --pt-p5: ${colorByName('muted', 'wine')};`,
    '  }',
    '  [data-density="compact"], .pt-compact {',
    '    --pt-spacing: 0.5rem;',
    '    --pt-card-padding: 0.5rem;',
    '    --pt-form-y: 0.25rem;',
    '    --pt-form-x: 0.5rem;',
    '    --pt-line-height: 1.35;',
    '    font-size: clamp(85%, 80% + 0.3vw, 95%);',
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

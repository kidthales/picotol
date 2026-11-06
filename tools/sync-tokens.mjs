// Synchronizes the 10 Paul Tol schemes (8 qualitative, 1 diverging, 1 sequential) + canonical achromatic stops
// from committed data/tol-qualitative.json into src/tokens.css + src/palettes.css.
// Refreshing data/tol-qualitative.json from upstream tol-palettes requires explicit
// invocation via npm run sync:upstream -- --upstream <path>.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRefreshOptions, resolveSyncOptions } from './path-jail.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const snapshotPath = join(dataDir, 'tol-qualitative.json');

const SCHEME_IDS = [
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

export function loadSnapshot(customSnapshotPath = snapshotPath) {
  if (!existsSync(customSnapshotPath)) {
    throw new Error(`Committed token snapshot ${customSnapshotPath} does not exist.`);
  }
  return JSON.parse(readFileSync(customSnapshotPath, 'utf8'));
}

export function refreshFromUpstream(rawUpstreamPath, opts = {}) {
  if (process.env.CI) {
    throw new Error('Refreshing tokens from upstream is forbidden in CI environments.');
  }
  if (!rawUpstreamPath || typeof rawUpstreamPath !== 'string' || rawUpstreamPath.trim() === '') {
    throw new Error('An explicit upstream path is required to refresh tokens: provide --upstream <path>');
  }
  const { targetSnapshotPath, isCustom } = resolveRefreshOptions(opts);
  const resolvedUpstream = resolve(rawUpstreamPath);
  const schemesDir = existsSync(join(resolvedUpstream, 'data', 'schemes'))
    ? join(resolvedUpstream, 'data', 'schemes')
    : resolvedUpstream;

  if (!existsSync(schemesDir)) {
    throw new Error(`Upstream schemes directory does not exist: ${schemesDir}`);
  }

  const schemes = {};
  const allowedHexSet = new Set();

  for (const id of SCHEME_IDS) {
    const schemeFile = join(schemesDir, `${id}.json`);
    if (!existsSync(schemeFile)) {
      throw new Error(`Required upstream scheme file missing: ${schemeFile}`);
    }
    const raw = JSON.parse(readFileSync(schemeFile, 'utf8'));
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
    const achFile = join(schemesDir, `${item.scheme}.json`);
    if (!existsSync(achFile)) {
      throw new Error(`Required upstream scheme file missing: ${achFile}`);
    }
    const raw = JSON.parse(readFileSync(achFile, 'utf8'));
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

  mkdirSync(dirname(targetSnapshotPath), { recursive: true });
  writeFileSync(targetSnapshotPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

  const syncOpts = isCustom ? { ...opts, snapshot } : {};
  const syncResult = syncTokens(syncOpts);
  return {
    ...syncResult,
    snapshot,
    snapshotPath: targetSnapshotPath,
    schemesDir,
  };
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
    '@layer picotol.legacy, picotol.tokens, picotol.reset, picotol.base, picotol.components, picotol.utilities;',
    '@layer picotol.tokens {',
    '  :root, :host, [data-accent="blue"] {',
    `    --pt-p1: ${colorByName('pale', 0)}; --pt-p2: ${colorByName('light', 'light_blue')}; --pt-p3: ${colorByName('bright', 'blue')}; --pt-p4: ${colorByName('dark', 3)}; --pt-p5: ${colorByName('high-contrast', 'blue')};`,
    '  }',
    '  :root, :host {',
    '    color-scheme: light dark;',
    '  }',
    '  :root, :host {',
    '    --pt-font-sans: system-ui, sans-serif;',
    '    --pt-font-mono: ui-monospace, monospace;',
    '    --pt-font-size-floor: 12px;',
    '    --pt-font-size-xs: max(var(--pt-font-size-floor, 12px), 0.75rem);',
    '    --pt-line-height: 1.5;',
    '    --pt-border-radius: 0.25rem;',
    '    --pt-transition: 0.15s ease-in-out;',
    '    --pt-spacing: 1rem;',
    '    --pt-card-padding: var(--pt-spacing);',
    '    --pt-form-y: 0.5rem;',
    '    --pt-form-x: 0.75rem;',
    '    --pt-table-cell-padding-block: 0.5rem;',
    '    --pt-table-cell-padding-inline: 0.75rem;',
    '    --pt-container-max: 70rem;',
    '    --pt-grid-min: 15rem;',
    '    --pt-grid-gap: var(--pt-spacing);',
    '    --pt-gap-compact: 0.5rem;',
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
    `    --pt-mark-bg: light-dark(${colorByName('pale', 3)}, ${colorByName('dark', 9)});`,
    '    --pt-box-shadow: 0 2px 8px color-mix(in srgb, var(--pt-color) 12%, transparent);',
    '    --pt-z-backdrop: 98;',
    '    --pt-z-tooltip: 99;',
    '    --pt-z-dropdown: 100;',
    '    --pt-z-modal: 999;',
    '    --pt-z-toast: 9990;',
    '    --pt-z-skip-link: 10000;',
    `    --pt-status-ok-fg: light-dark(${colorByName('bright', 'green')}, ${colorByName('muted', 'teal')});`,
    '    --pt-status-ok-border: var(--pt-status-ok-fg);',
    '    --pt-status-ok-bg: color-mix(in srgb, var(--pt-status-ok-border) 8%, transparent);',
    `    --pt-status-warning-fg: light-dark(${colorByName('ylorbr', 1)}, ${colorByName('high-contrast', 'yellow')});`,
    `    --pt-status-warning-border: light-dark(${colorByName('high-contrast', 'yellow')}, ${colorByName('light', 'orange')});`,
    '    --pt-status-warning-bg: color-mix(in srgb, var(--pt-status-warning-border) 8%, transparent);',
    `    --pt-status-critical-fg: light-dark(${colorByName('vibrant', 'red')}, ${colorByName('bright', 'red')});`,
    '    --pt-status-critical-border: var(--pt-status-critical-fg);',
    '    --pt-status-critical-bg: color-mix(in srgb, var(--pt-status-critical-border) 8%, transparent);',
    `    --pt-status-info-fg: light-dark(${colorByName('bright', 'blue')}, ${colorByName('bright', 'cyan')});`,
    '    --pt-status-info-border: var(--pt-status-info-fg);',
    '    --pt-status-info-bg: color-mix(in srgb, var(--pt-status-info-border) 8%, transparent);',
    '  }',
    '  :root, :host, :where([data-accent]) {',
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
    '    --pt-table-cell-padding-block: 0.25rem;',
    '    --pt-table-cell-padding-inline: 0.5rem;',
    '    --pt-grid-gap: var(--pt-gap-compact);',
    '    --pt-line-height: 1.35;',
    '    font-size: clamp(0.85rem, 0.8rem + 0.3vw, 0.95rem);',
    '  }',
    '  [data-density="tight"], .pt-tight {',
    '    --pt-spacing: 0.25rem;',
    '    --pt-card-padding: 0.25rem;',
    '    --pt-form-y: 0.125rem;',
    '    --pt-form-x: 0.375rem;',
    '    --pt-table-cell-padding-block: 0.125rem;',
    '    --pt-table-cell-padding-inline: 0.375rem;',
    '    --pt-grid-gap: var(--pt-spacing);',
    '    --pt-gap-compact: 0.25rem;',
    '    --pt-line-height: 1.25;',
    '    font-size: var(--pt-font-size-xs);',
    '  }',
    '}',
    '',
  ];

  return lines.join('\n');
}

export function buildPalettesCss(snapshot = loadSnapshot()) {
  const lines = [
    '@layer picotol.tokens {',
    '  :root, :host {',
  ];

  const achromaticHexes = new Set(snapshot.achromatic.map((a) => a.hex.toUpperCase()));

  for (const id of SCHEME_IDS) {
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

export function syncTokens(opts = {}) {
  const { targetTokensPath, targetPalettesPath, hasSnapshot } = resolveSyncOptions(opts);
  const snapshot = hasSnapshot ? opts.snapshot : loadSnapshot();
  const tokensCss = buildTokensCss(snapshot);
  const palettesCss = buildPalettesCss(snapshot);
  mkdirSync(dirname(targetTokensPath), { recursive: true });
  mkdirSync(dirname(targetPalettesPath), { recursive: true });
  writeFileSync(targetTokensPath, tokensCss, 'utf8');
  writeFileSync(targetPalettesPath, palettesCss, 'utf8');
  return {
    snapshot,
    tokensCss,
    palettesCss,
    tokensCssPath: targetTokensPath,
    palettesCssPath: targetPalettesPath,
  };
}

export function parseCliArgs(argv = process.argv.slice(2)) {
  let isUpstream = false;
  let upstreamPath = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--upstream') {
      isUpstream = true;
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        upstreamPath = next;
        i++;
      }
    } else if (arg.startsWith('--upstream=')) {
      isUpstream = true;
      upstreamPath = arg.slice('--upstream='.length);
    } else {
      throw new Error(`Unrecognized argument: ${arg}`);
    }
  }

  return { isUpstream, upstreamPath };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let isUpstream = false;
  let upstreamPath = null;
  try {
    const parsed = parseCliArgs();
    isUpstream = parsed.isUpstream;
    upstreamPath = parsed.upstreamPath;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  if (isUpstream) {
    if (!upstreamPath) {
      console.error('Error: An explicit upstream path is required to refresh tokens: provide --upstream <path>');
      process.exit(1);
    }
    try {
      const { snapshot, schemesDir } = refreshFromUpstream(upstreamPath);
      console.log(
        `Refreshed ${Object.keys(snapshot.schemes).length} schemes from ${schemesDir} -> data/tol-qualitative.json + src/tokens.css & src/palettes.css`
      );
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  } else {
    try {
      const { snapshot } = syncTokens();
      console.log(`Synced ${Object.keys(snapshot.schemes).length} Paul Tol schemes -> src/tokens.css & src/palettes.css`);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  }
}
